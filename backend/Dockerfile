# Dockerfile para microservicio Spring Boot (Java 21)
# Optimizado para AWS ECS Fargate (linux/amd64)
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

# Copia el artefacto compilado por Maven (backend_deploy.yml / publicar-ecs.sh)
COPY target/*.jar app.jar

EXPOSE 8080

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
