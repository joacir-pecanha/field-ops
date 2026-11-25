 # Stage 1: Build executable Spring Boot JAR with JDK 23
FROM eclipse-temurin:23-jdk-alpine AS build
WORKDIR /app

COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline -Djava.version=23

COPY src src
RUN ./mvnw -B package -DskipTests -Djava.version=23

# Stage 2: Lightweight runtime image
FROM eclipse-temurin:23-jre-alpine
WORKDIR /app

RUN mkdir -p /var/lib/fieldops/evidences

COPY --from=build /app/target/field-ops-backend-*.jar /app/app.jar

ENV PORT=8080 \
    EVIDENCE_STORAGE_DIR=/var/lib/fieldops/evidences

EXPOSE 8080

ENTRYPOINT ["java", "-Xms256m", "-Xmx1024m", "-jar", "/app/app.jar"]