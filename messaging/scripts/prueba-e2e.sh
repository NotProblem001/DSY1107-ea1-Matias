#!/usr/bin/env bash
# Prueba end-to-end: cluster, topologia, ACK, NACK/reintento -> DLQ, REJECT -> DLQ y API del administrador.
# Requiere: docker compose --profile apps up -d --build --wait  (en messaging/)
set -euo pipefail

EVENTOS=${EVENTOS:-http://localhost:8091}
ADMIN=${ADMIN:-http://localhost:8097}
MGMT=${MGMT:-http://localhost:15672}
CRED=${CRED:-admin:admin123}
fallos=0

ok()   { echo "  [OK]  $*"; }
fail() { echo "  [FAIL] $*"; fallos=$((fallos + 1)); }
esperar() { sleep "${1:-3}"; }

evento() { # $1=pedidoId $2=tipo $3=simularFallo
  curl -s -o /dev/null -w "%{http_code}" -X POST "$EVENTOS/api/eventos/pedidos" -H 'Content-Type: application/json' \
    -d "{\"pedidoId\":$1,\"clienteEmail\":\"cliente@pedidos360.com\",\"descripcion\":\"Switch Cisco\",\"monto\":1250000,\"tipo\":\"$2\",\"simularFallo\":\"$3\"}"
}
logs() { docker logs pedidos-mensajeria-ms 2>&1; }

echo "1. Cluster"
nodos=$(docker exec rabbitmq-1 rabbitmqctl cluster_status --formatter json | grep -o 'rabbit@rabbitmq-[0-9]' | sort -u | wc -l)
[ "$nodos" -ge 2 ] && ok "$nodos nodos en el cluster" || fail "cluster con $nodos nodos"

echo "2. Topologia (3 colas + 3 DLQ quorum, exchanges topic y direct)"
for q in notificaciones tickets documentos; do
  for s in queue dlq; do
    tipo=$(curl -s -u "$CRED" "$MGMT/api/queues/%2F/$q.$s" | grep -o '"type":"[a-z]*"' | head -1)
    [ "$tipo" = '"type":"quorum"' ] && ok "$q.$s quorum" || fail "$q.$s ($tipo)"
  done
done
for ex in pedidos.eventos:topic pedidos.documentos:direct pedidos.dlx:direct; do
  curl -s -u "$CRED" "$MGMT/api/exchanges/%2F/${ex%%:*}" | grep -q "\"type\":\"${ex##*:}\"" && ok "exchange $ex" || fail "exchange $ex"
done

echo "3. Camino feliz: ACK"
[ "$(evento 101 CREADO NINGUNO)" = 202 ] && ok "evento aceptado (202)" || fail "evento no aceptado"
esperar
logs | grep -q '\[TICKETS\] ACK pedido=101' && ok "tickets ACK" || fail "tickets sin ACK"
logs | grep -q '\[DOCUMENTOS\] ACK pedido=101' && ok "documentos ACK" || fail "documentos sin ACK"
logs | grep -q '\[NOTIFICACIONES\] ACK pedido=101' && ok "notificaciones ACK" || fail "notificaciones sin ACK"

echo "4. Error transitorio: 3 reintentos y luego NACK -> DLQ"
evento 102 ACTUALIZADO TRANSITORIO >/dev/null
esperar 5
n=$(logs | grep -c '\[NOTIFICACIONES\] Reintento' || true)
[ "$n" -eq 3 ] && ok "3 reintentos" || fail "reintentos: $n"
logs | grep -q '\[NOTIFICACIONES\] NACK -> DLQ tras 3 reintentos' && ok "NACK sin requeue" || fail "sin NACK final"
logs | grep -q '\[DLQ\] cola=notificaciones.dlq.*"pedidoId":102' && ok "pedido 102 auditado en la DLQ" || fail "pedido 102 no llego a la DLQ"

echo "5. Error permanente: REJECT directo a DLQ"
evento 103 CANCELADO PERMANENTE >/dev/null
esperar
logs | grep -q '\[NOTIFICACIONES\] REJECT -> DLQ' && ok "REJECT sin requeue" || fail "sin REJECT"
logs | grep -q '\[DLQ\] cola=notificaciones.dlq.*"pedidoId":103' && ok "pedido 103 auditado en la DLQ" || fail "pedido 103 no llego a la DLQ"

echo "6. Validacion del productor"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$EVENTOS/api/eventos/pedidos" -H 'Content-Type: application/json' -d '{"pedidoId":-1}')
[ "$c" = 400 ] && ok "evento invalido -> 400" || fail "evento invalido -> $c"

echo "7. Administrador RabbitMQ"
J='Content-Type: application/json'
curl -s -o /dev/null -X DELETE "$ADMIN/api/rabbitmq/queues/demo.queue" || true
curl -s -o /dev/null -X DELETE "$ADMIN/api/rabbitmq/exchanges/demo.headers" || true
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ADMIN/api/rabbitmq/exchanges" -H "$J" -d '{"nombre":"demo.headers","tipo":"HEADERS"}')" = 201 ] && ok "POST /exchanges (headers) 201" || fail "POST /exchanges"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ADMIN/api/rabbitmq/queues" -H "$J" -d '{"nombre":"demo.queue","ttlMs":30000,"maxLength":10,"deadLetterExchange":"pedidos.dlx","deadLetterRoutingKey":"notificaciones.dead","deliveryLimit":2}')" = 201 ] && ok "POST /queues 201" || fail "POST /queues"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ADMIN/api/rabbitmq/queues" -H "$J" -d '{"nombre":"demo.queue"}')" = 409 ] && ok "cola duplicada 409" || fail "duplicada"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ADMIN/api/rabbitmq/queues" -H "$J" -d '{"nombre":"  "}')" = 400 ] && ok "nombre vacio 400" || fail "nombre vacio"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ADMIN/api/rabbitmq/bindings" -H "$J" -d '{"cola":"demo.queue","exchange":"demo.headers","argumentos":{"x-match":"all","region":"rm"}}')" = 201 ] && ok "POST /bindings 201" || fail "POST /bindings"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ADMIN/api/rabbitmq/bindings" -H "$J" -d '{"cola":"demo.queue","exchange":"no.existe"}')" = 404 ] && ok "binding a exchange inexistente 404" || fail "binding inexistente"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$ADMIN/api/rabbitmq/bindings" -H "$J" -d '{"cola":"demo.queue","exchange":"demo.headers","argumentos":{"x-match":"all","region":"rm"}}')" = 204 ] && ok "DELETE /bindings 204" || fail "DELETE /bindings"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$ADMIN/api/rabbitmq/queues/demo.queue")" = 200 ] && ok "GET /queues/demo.queue 200" || fail "GET /queues"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$ADMIN/api/rabbitmq/queues/demo.queue")" = 204 ] && ok "DELETE /queues 204" || fail "DELETE /queues"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$ADMIN/api/rabbitmq/queues/demo.queue")" = 404 ] && ok "DELETE cola inexistente 404" || fail "DELETE inexistente"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$ADMIN/api/rabbitmq/exchanges/demo.headers")" = 204 ] && ok "DELETE /exchanges 204" || fail "DELETE /exchanges"

echo
[ "$fallos" -eq 0 ] && echo "RESULTADO: todo OK" || { echo "RESULTADO: $fallos fallo(s)"; exit 1; }
