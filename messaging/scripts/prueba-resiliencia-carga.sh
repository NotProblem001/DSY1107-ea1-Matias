#!/usr/bin/env bash
# Bateria extendida (complementa prueba-e2e.sh): routing exclusivo, fanout, requeue true/false,
# TTL -> DLQ, durabilidad tras reiniciar los 3 nodos y carga de N eventos concurrentes.
# Requiere el stack arriba: docker compose --profile apps up -d --build --wait  (en messaging/)
#   N_CARGA=2000 PARALELO=20 bash scripts/prueba-resiliencia-carga.sh
set -euo pipefail

EVENTOS=${EVENTOS:-http://localhost:8091}
ADMIN=${ADMIN:-http://localhost:8097}
MGMT=${MGMT:-http://localhost:15672}
CRED=${CRED:-admin:admin123}
N=${N_CARGA:-2000}
PAR=${PARALELO:-20}
PY=python; command -v python >/dev/null 2>&1 || PY=python3
J='Content-Type: application/json'
INICIO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
fallos=0

ok()   { echo "  [OK]  $*"; }
fail() { echo "  [FAIL] $*"; fallos=$((fallos + 1)); }
check() { [ "$1" = "$2" ] && ok "$3 ($1)" || fail "$3: esperado $2, obtenido $1"; }
logs() { docker logs --since "$INICIO" pedidos-mensajeria-ms 2>&1; }
ahora() { $PY -c 'import time;print(time.time())'; }

admin() { # metodo ruta [json] -> codigo HTTP
  if [ -n "${3:-}" ]; then curl -s -o /dev/null -w '%{http_code}' -X "$1" "$ADMIN$2" -H "$J" -d "$3"
  else curl -s -o /dev/null -w '%{http_code}' -X "$1" "$ADMIN$2"; fi
}
mensajes() { # conteo exacto (declaracion pasiva via rabbit-admin-ms)
  curl -s "$ADMIN/api/rabbitmq/queues/$1" | $PY -c 'import json,sys;print(json.load(sys.stdin).get("mensajes","?"))'
}
publicar() { # exchange routing_key payload  (persistente, delivery_mode=2)
  local ex=$1; [ "$ex" = "" ] && ex=amq.default
  curl -s -u "$CRED" -X POST "$MGMT/api/exchanges/%2F/$ex/publish" -H "$J" \
    -d "{\"properties\":{\"delivery_mode\":2},\"routing_key\":\"$2\",\"payload\":\"$3\",\"payload_encoding\":\"string\"}" >/dev/null
}
obtener() { # cola ackmode -> lista de motivos x-death (o "-")
  curl -s -u "$CRED" -X POST "$MGMT/api/queues/%2F/$1/get" -H "$J" -d "{\"count\":10,\"ackmode\":\"$2\",\"encoding\":\"auto\"}" \
    | $PY -c 'import json,sys
m=json.load(sys.stdin)
print(",".join(sorted({(x.get("properties",{}).get("headers") or {}).get("x-death",[{}])[0].get("reason","-") for x in m})) or "vacia")'
}
evento() { # pedidoId tipo
  curl -s -o /dev/null -w '%{http_code}' -X POST "$EVENTOS/api/eventos/pedidos" -H "$J" \
    -d "{\"pedidoId\":$1,\"clienteEmail\":\"carga@pedidos360.com\",\"descripcion\":\"Prueba\",\"monto\":1000,\"tipo\":\"$2\"}"
}
limpiar() {
  for q in test.fan.a test.fan.b test.fan.c test.requeue test.ttl test.dlq test.durable; do admin DELETE "/api/rabbitmq/queues/$q" >/dev/null || true; done
  for e in test.fanout test.dlx; do admin DELETE "/api/rabbitmq/exchanges/$e" >/dev/null || true; done
}

limpiar

echo "1. Routing exclusivo por routing key (topic)"
evento 501 ACTUALIZADO >/dev/null; sleep 3
logs | grep -q '\[NOTIFICACIONES\] ACK pedido=501$' && ok "pedido.actualizado llega a notificaciones (pedido.#)" || fail "notificaciones no recibio pedido.actualizado"
logs | grep -q '\[TICKETS\] ACK pedido=501$' && fail "tickets recibio pedido.actualizado" || ok "tickets NO recibe pedido.actualizado (solo pedido.creado)"
logs | grep -q '\[DOCUMENTOS\] ACK pedido=501$' && fail "documentos recibio un evento topic" || ok "documentos NO recibe eventos del topic (solo direct)"

echo "2. Fanout: copia a todas las colas enlazadas, ignora la routing key"
check "$(admin POST /api/rabbitmq/exchanges '{"nombre":"test.fanout","tipo":"FANOUT"}')" 201 "exchange fanout creado"
for q in a b c; do admin POST /api/rabbitmq/queues "{\"nombre\":\"test.fan.$q\"}" >/dev/null; done
for q in a b; do admin POST /api/rabbitmq/bindings "{\"cola\":\"test.fan.$q\",\"exchange\":\"test.fanout\"}" >/dev/null; done
publicar test.fanout cualquier.cosa "hola-fanout"; sleep 1
check "$(mensajes test.fan.a)" 1 "test.fan.a (enlazada) recibe"
check "$(mensajes test.fan.b)" 1 "test.fan.b (enlazada) recibe"
check "$(mensajes test.fan.c)" 0 "test.fan.c (sin binding) no recibe"

echo "3. Rechazo con requeue=true y requeue=false"
admin POST /api/rabbitmq/exchanges '{"nombre":"test.dlx","tipo":"DIRECT"}' >/dev/null
admin POST /api/rabbitmq/queues '{"nombre":"test.dlq"}' >/dev/null
admin POST /api/rabbitmq/bindings '{"cola":"test.dlq","exchange":"test.dlx","routingKey":"test.dead"}' >/dev/null
admin POST /api/rabbitmq/queues '{"nombre":"test.requeue","deadLetterExchange":"test.dlx","deadLetterRoutingKey":"test.dead"}' >/dev/null
publicar "" test.requeue "mensaje-rechazado"; sleep 1
obtener test.requeue reject_requeue_true >/dev/null; sleep 1
check "$(mensajes test.requeue)" 1 "reject requeue=true: vuelve a la cola"
check "$(mensajes test.dlq)" 0 "reject requeue=true: no va a la DLQ"
obtener test.requeue reject_requeue_false >/dev/null; sleep 1
check "$(mensajes test.requeue)" 0 "reject requeue=false: sale de la cola"
check "$(mensajes test.dlq)" 1 "reject requeue=false: llega a la DLQ"

echo "4. Expiracion por TTL -> DLQ"
admin POST /api/rabbitmq/queues '{"nombre":"test.ttl","ttlMs":1500,"deadLetterExchange":"test.dlx","deadLetterRoutingKey":"test.dead"}' >/dev/null
publicar "" test.ttl "mensaje-que-expira"; sleep 4
check "$(mensajes test.ttl)" 0 "test.ttl vacia tras 1.5 s de TTL"
check "$(mensajes test.dlq)" 2 "DLQ acumula rechazado + expirado"
check "$(obtener test.dlq ack_requeue_true)" "expired,rejected" "x-death.reason en la DLQ"

echo "5. Durabilidad: reinicio de los 3 nodos"
admin POST /api/rabbitmq/queues '{"nombre":"test.durable"}' >/dev/null
for i in $(seq 1 50); do publicar "" test.durable "persistente-$i"; done; sleep 1
check "$(mensajes test.durable)" 50 "50 mensajes persistentes antes del reinicio"
t0=$(ahora)
docker compose restart rabbitmq-1 rabbitmq-2 rabbitmq-3 >/dev/null 2>&1
for i in $(seq 1 60); do [ "$(admin GET /api/rabbitmq/queues/test.durable)" = 200 ] && break; sleep 2; done
echo "  cluster disponible tras $($PY -c "print(round($(ahora)-$t0,1))") s"
check "$(mensajes test.durable)" 50 "50 mensajes siguen tras el reinicio"
check "$(mensajes test.dlq)" 2 "DLQ conserva sus mensajes tras el reinicio"
for i in $(seq 1 30); do evento 502 CREADO >/dev/null; sleep 2; logs | grep -q '\[TICKETS\] ACK pedido=502$' && break; done
logs | grep -q '\[TICKETS\] ACK pedido=502$' && ok "consumidores se reconectan solos y procesan" || fail "consumidores no se reconectaron"
nodos=$(docker exec rabbitmq-1 rabbitmqctl cluster_status --formatter json | $PY -c 'import json,sys;print(len(json.load(sys.stdin)["running_nodes"]))')
check "$nodos" 3 "nodos en ejecucion tras el reinicio"

echo "6. Carga: $N eventos CREADO concurrentes ($PAR en paralelo) => $((3 * N)) entregas"
acks_previos=$(logs | grep -cE ' ACK pedido=1[0-9]{5}$' || true)
t0=$(ahora)
# Generador con hilos (stdlib): sin un proceso curl por request, que limitaba la tasa del cliente.
# ids 100001..(100000+N): 6 digitos, distinguibles de los pedidos de las otras pruebas
aceptados=$($PY - "$EVENTOS" "$N" "$PAR" <<'EOF'
import json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
url, n, par = sys.argv[1] + "/api/eventos/pedidos", int(sys.argv[2]), int(sys.argv[3])
def enviar(i):
    body = json.dumps({"pedidoId": 100000 + i, "clienteEmail": "carga@pedidos360.com",
                       "descripcion": "Carga", "monto": 1, "tipo": "CREADO"}).encode()
    req = urllib.request.Request(url, body, {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except Exception:
        return 0
with ThreadPoolExecutor(par) as ex:
    print(sum(1 for s in ex.map(enviar, range(1, n + 1)) if s == 202))
EOF
)
t1=$(ahora)
check "$aceptados" "$N" "eventos aceptados (HTTP 202)"
pico=0
for i in $(seq 1 120); do
  pend=$(( $(mensajes notificaciones.queue) + $(mensajes tickets.queue) + $(mensajes documentos.queue) ))
  [ "$pend" -gt "$pico" ] && pico=$pend
  [ "$pend" -eq 0 ] && [ "$(logs | grep -cE ' ACK pedido=1[0-9]{5}$')" -ge $((acks_previos + 3 * N)) ] && break
  sleep 1
done
t2=$(ahora)
acks=$(( $(logs | grep -cE ' ACK pedido=1[0-9]{5}$') - acks_previos ))
rechazos=$(logs | grep -cE '(REJECT|NACK).*' || true)
muertos=$(logs | grep -cE '\[DLQ\].*"pedidoId":1[0-9]{5}' || true)
echo "  ACK=$acks + DLQ=$muertos (motivos: $(logs | grep -aE '\[DLQ\].*"pedidoId":1[0-9]{5}' | grep -oE 'motivo=[a-z_]+' | sort | uniq -c | tr -s ' ' | tr '\n' ' '))"
check "$((acks + muertos))" "$((3 * N))" "ninguna entrega perdida (ACK + DLQ)"
check "$acks" "$((3 * N))" "todas procesadas con ACK (ninguna por x-max-length/TTL)"
check "$(mensajes notificaciones.queue)/$(mensajes tickets.queue)/$(mensajes documentos.queue)" "0/0/0" "colas vaciadas"
check "$rechazos" 0 "REJECT/NACK durante la prueba"
echo "  publicacion: $($PY -c "print(round($t1-$t0,1))") s -> $($PY -c "print(round($N/($t1-$t0)))") eventos/s"
echo "  procesamiento total: $($PY -c "print(round($t2-$t0,1))") s -> $($PY -c "print(round(3*$N/($t2-$t0)))") entregas/s"
echo "  pico de mensajes en espera: $pico"
curl -s -u "$CRED" "$MGMT/api/nodes" | $PY -c 'import json,sys
for n in json.load(sys.stdin):
    print("  nodo %s: memoria %d MB (limite %d MB) alarma_mem=%s alarma_disco=%s sockets/fd=%s" % (n["name"], n["mem_used"]//2**20, n["mem_limit"]//2**20, n["mem_alarm"], n["disk_free_alarm"], n.get("fd_used","?")))'
curl -s -u "$CRED" "$MGMT/api/overview" | $PY -c 'import json,sys;o=json.load(sys.stdin)["object_totals"];print("  conexiones=%s canales=%s consumidores=%s" % (o["connections"],o["channels"],o["consumers"]))'

limpiar
echo
[ "$fallos" -eq 0 ] && echo "RESULTADO: todo OK" || { echo "RESULTADO: $fallos fallo(s)"; exit 1; }
