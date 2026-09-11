# =============================================================================
# Dockerfile Multi-Stage para Microservicio Spring Boot (Java 21)
# Plataforma de destino: linux/amd64 (AWS ECS Fargate)
# =============================================================================

# Stage 1: Compilación y empaquetado del artefacto
FROM --platform=linux/amd64 eclipse-temurin:21-jdk-jammy AS builder

WORKDIR /build

# Copiar wrapper y descriptor del proyecto
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Dar permisos de ejecución al Maven Wrapper
RUN chmod +x mvnw

# Descargar dependencias en caché
RUN ./mvnw --batch-mode dependency:go-offline -DskipTests || true

# Copiar código fuente y compilar JAR
COPY src src
RUN ./mvnw --batch-mode clean package -DskipTests

# =============================================================================
# Stage 2: Imagen final de ejecución con JRE 21 ligero
# =============================================================================
FROM --platform=linux/amd64 eclipse-temurin:21-jre-jammy

WORKDIR /app

# Copiar artefacto generado en la etapa de construcción
COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8080

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
