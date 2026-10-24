package com.DSY1107.rabbitadmin.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "monitoreo")
public record MonitoreoProperties(long intervaloMs, long umbralMensajes, List<String> colas) {
}
