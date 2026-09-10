package com.DSY1107.cloudnative.controller;

import com.DSY1107.cloudnative.model.RevisionRequest;
import com.DSY1107.cloudnative.model.SolicitudVacaciones;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Controlador REST para la Gestion de Solicitudes de Vacaciones (DSY1107 RA1).
 *
 * PRINCIPIO DE SEGURIDAD PERIMETRAL (CLOUD NATIVE):
 * Este microservicio NO realiza verificaciones manuales de roles ni parseo de JWT.
 * Asume el principio de confianza perimetral estricta: todo request que llega a este
 * controlador ya fue autenticado y filtrado por el Scope Guard de AWS API Gateway HTTP v2.
 */
@RestController
public class SolicitudesController {

    private final ConcurrentHashMap<Long, SolicitudVacaciones> almacen = new ConcurrentHashMap<>();
    private final AtomicLong contadorId = new AtomicLong(1);

    public SolicitudesController() {
        // Datos iniciales de demostración
        SolicitudVacaciones s1 = new SolicitudVacaciones(
                contadorId.getAndIncrement(),
                "solicitante@duocuc.cl",
                "2026-02-01",
                "2026-02-15",
                14,
                "Vacaciones de verano familiares",
                "PENDIENTE"
        );
        almacen.put(s1.getId(), s1);

        SolicitudVacaciones s2 = new SolicitudVacaciones(
                contadorId.getAndIncrement(),
                "colaborador@duocuc.cl",
                "2026-07-10",
                "2026-07-17",
                7,
                "Descanso invernal",
                "APROBADA"
        );
        s2.setComentarioRevision("Aprobado según disponibilidad del equipo.");
        s2.setAprobadorEmail("aprobador@duocuc.cl");
        almacen.put(s2.getId(), s2);
    }

    /**
     * Endpoint publico para contraste y verificacion de estado.
     * Ruta: GET /publico/info (sin autorizador en API Gateway).
     */
    @GetMapping("/publico/info")
    public ResponseEntity<Map<String, Object>> obtenerInfoPublica() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("sistema", "Gestion de Solicitudes de Vacaciones");
        info.put("version", "1.0.0");
        info.put("estado", "OPERATIVO");
        info.put("timestamp", LocalDateTime.now().toString());
        info.put("seguridad", "Perimetral con AWS Cognito IDaaS + API Gateway Scope Guard");
        info.put("rolesDefinidos", List.of(
                Map.of("rol", "solicitantes", "scopes", List.of("solicitudes/read", "solicitudes/write")),
                Map.of("rol", "aprobadores", "scopes", List.of("solicitudes/read", "solicitudes/approve"))
        ));
        info.put("totalSolicitudes", almacen.size());
        return ResponseEntity.ok(info);
    }

    /**
     * Listar todas las solicitudes (o filtrar por solicitante).
     * Ruta: GET /solicitudes (requiere scope: solicitudes/read).
     */
    @GetMapping("/solicitudes")
    public ResponseEntity<List<SolicitudVacaciones>> listar(
            @RequestParam(required = false) String solicitante,
            @RequestParam(required = false) String estado) {
        List<SolicitudVacaciones> lista = new ArrayList<>(almacen.values());

        if (solicitante != null && !solicitante.isBlank()) {
            lista.removeIf(s -> !s.getSolicitanteEmail().equalsIgnoreCase(solicitante));
        }
        if (estado != null && !estado.isBlank()) {
            lista.removeIf(s -> !s.getEstado().equalsIgnoreCase(estado));
        }

        // Orden descendente por ID
        lista.sort(Comparator.comparing(SolicitudVacaciones::getId).reversed());
        return ResponseEntity.ok(lista);
    }

    /**
     * Consultar detalle de una solicitud.
     * Ruta: GET /solicitudes/{id} (requiere scope: solicitudes/read).
     */
    @GetMapping("/solicitudes/{id}")
    public ResponseEntity<SolicitudVacaciones> obtenerPorId(@PathVariable Long id) {
        SolicitudVacaciones solicitud = almacen.get(id);
        if (solicitud == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(solicitud);
    }

    /**
     * Crear una nueva solicitud de vacaciones.
     * Ruta: POST /solicitudes (requiere scope: solicitudes/write).
     */
    @PostMapping("/solicitudes")
    public ResponseEntity<SolicitudVacaciones> crear(@RequestBody SolicitudVacaciones nueva) {
        long nuevoId = contadorId.getAndIncrement();
        nueva.setId(nuevoId);
        nueva.setEstado("PENDIENTE");
        nueva.setComentarioRevision(null);
        nueva.setAprobadorEmail(null);

        almacen.put(nuevoId, nueva);
        return ResponseEntity.status(HttpStatus.CREATED).body(nueva);
    }

    /**
     * Modificar una solicitud existente.
     * Ruta: PUT /solicitudes/{id} (requiere scope: solicitudes/write).
     */
    @PutMapping("/solicitudes/{id}")
    public ResponseEntity<SolicitudVacaciones> actualizar(
            @PathVariable Long id,
            @RequestBody SolicitudVacaciones datos) {
        SolicitudVacaciones existente = almacen.get(id);
        if (existente == null) {
            return ResponseEntity.notFound().build();
        }

        existente.setFechaInicio(datos.getFechaInicio());
        existente.setFechaFin(datos.getFechaFin());
        existente.setDias(datos.getDias());
        existente.setMotivo(datos.getMotivo());

        almacen.put(id, existente);
        return ResponseEntity.ok(existente);
    }

    /**
     * Eliminar una solicitud.
     * Ruta: DELETE /solicitudes/{id} (requiere scope: solicitudes/write).
     */
    @DeleteMapping("/solicitudes/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        if (!almacen.containsKey(id)) {
            return ResponseEntity.notFound().build();
        }
        almacen.remove(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Acción del Aprobador: Aprobar solicitud con comentario.
     * Ruta: POST /solicitudes/{id}/aprobar (requiere scope: solicitudes/approve).
     */
    @PostMapping("/solicitudes/{id}/aprobar")
    public ResponseEntity<SolicitudVacaciones> aprobar(
            @PathVariable Long id,
            @RequestBody(required = false) RevisionRequest revision) {
        SolicitudVacaciones existente = almacen.get(id);
        if (existente == null) {
            return ResponseEntity.notFound().build();
        }

        existente.setEstado("APROBADA");
        if (revision != null) {
            existente.setComentarioRevision(revision.getComentario());
            existente.setAprobadorEmail(revision.getAprobadorEmail() != null ? revision.getAprobadorEmail() : "aprobador@duocuc.cl");
        } else {
            existente.setComentarioRevision("Solicitud aprobada.");
            existente.setAprobadorEmail("aprobador@duocuc.cl");
        }

        almacen.put(id, existente);
        return ResponseEntity.ok(existente);
    }

    /**
     * Acción del Aprobador: Rechazar solicitud con comentario.
     * Ruta: POST /solicitudes/{id}/rechazar (requiere scope: solicitudes/approve).
     */
    @PostMapping("/solicitudes/{id}/rechazar")
    public ResponseEntity<SolicitudVacaciones> rechazar(
            @PathVariable Long id,
            @RequestBody(required = false) RevisionRequest revision) {
        SolicitudVacaciones existente = almacen.get(id);
        if (existente == null) {
            return ResponseEntity.notFound().build();
        }

        existente.setEstado("RECHAZADA");
        if (revision != null) {
            existente.setComentarioRevision(revision.getComentario());
            existente.setAprobadorEmail(revision.getAprobadorEmail() != null ? revision.getAprobadorEmail() : "aprobador@duocuc.cl");
        } else {
            existente.setComentarioRevision("Solicitud rechazada por requerimientos de servicio.");
            existente.setAprobadorEmail("aprobador@duocuc.cl");
        }

        almacen.put(id, existente);
        return ResponseEntity.ok(existente);
    }
}
