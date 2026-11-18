# terraform-kafka: Kafka y pedidos-streaming-ms en AWS

Despliega en una EC2 (Amazon Linux 2023, t3.medium, con Elastic IP) el `streaming/docker-compose.yml` completo: Zookeeper, Kafka y Kafka-UI, más `pedidos-streaming-ms` desde ECR (profile `apps`). Encima pone un **API Gateway HTTPS con JWT de Cognito** (`api.tf`, el mismo archivo que usa `terraform-rabbitmq/`), que es lo que consume la pestaña **Mensajería en vivo** del frontend en Amplify.

```bash
./terraform-kafka/desplegar.sh            # ECR -> build/push de la imagen -> apply
./terraform-kafka/desplegar.sh destroy    # destruye todo (EC2, EIP, ECR, API)
```

`desplegar.sh` resuelve en vivo el User Pool y el client `spa-react` de Cognito y el origen de Amplify, que vienen del stack `terraform/` de la EA1. Para sobrescribirlos, usa `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` y `AMPLIFY_ORIGEN`.

## Seguridad

| Puerto | Abierto a | Por qué |
|---|---|---|
| 8092 (API) | `0.0.0.0/0` | API Gateway sale por IPs de AWS que no son fijas |
| 8085 (Kafka-UI) | solo `ip_permitida` | panel de operador |
| 9092 (Kafka) | cerrado | el microservicio usa `kafka:29092` por la red Docker |

Como la API queda abierta, `FiltroOrigen` en el microservicio exige el header `x-origen-secreto` (un `random_password`). Ese header lo agrega **solo** API Gateway, después de validar el JWT. Una llamada directa a `http://<ip>:8092/api/...` responde **403**; solo `/actuator/health` queda libre.

Hacia el frontend solo se exponen las rutas de `local.rutas` en `main.tf`: demo/con-key/recibidos del 3.2.1 y demo/evento/alertas del 3.2.2.

## Notas

- El listener `PLAINTEXT_HOST` del compose anuncia `localhost:9092`, así que un cliente Kafka fuera de la EC2 no funcionaría. Por eso el 9092 no se abre.
- La Elastic IP mantiene la misma IP aunque el Learner Lab apague y encienda la EC2, así que las integraciones de API Gateway no quedan apuntando a una IP vieja.
- Costo aproximado: t3.medium + EIP ≈ USD 0,047/h mientras esté arriba.
