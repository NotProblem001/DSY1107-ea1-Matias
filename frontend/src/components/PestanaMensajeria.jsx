import { useEffect, useState } from 'react'
import { config } from '../auth.js'
import {
  kafkaDemo,
  kafkaConKey,
  kafkaRecibidos,
  pipelineEvento,
  pipelineAlertas,
  rabbitPublicar,
  rabbitCola,
  rabbitAlertas,
} from '../api.js'

const INTERVALO_MS = 2000
// Mismos umbrales que pedidos.pipeline.* en streaming/pedidos-streaming-ms/application.yml (solo para rotular lo esperado)
const MONTO_MINIMO = 1000
const MONTO_SOSPECHOSO = 1000000
const COLAS = ['notificaciones.queue', 'tickets.queue', 'documentos.queue', 'notificaciones.dlq', 'tickets.dlq', 'documentos.dlq']
const PRESETS = [
  { nombre: 'Normal', cliente: 'cliente-normal', monto: 50000, canal: 'web' },
  { nombre: 'Sospechoso', cliente: 'cliente-sospechoso', monto: 2000000, canal: 'app' },
  { nombre: 'Ignorado', cliente: 'cliente-ignorado', monto: 500, canal: 'sucursal' },
]

const pesos = (n) => Number(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CL') : '')

// Color estable por key: la misma key siempre se ve igual, así se nota que no cambia de partición
function colorKey(key) {
  if (key == null) return 'var(--tenue)'
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 70% 65%)`
}

function esperadoPipeline(monto) {
  if (monto < MONTO_MINIMO) return { texto: 'Ignorado (bajo el mínimo)', clase: 'badge-aviso' }
  if (monto > MONTO_SOSPECHOSO) return { texto: 'Genera alerta', clase: 'badge-mal' }
  return { texto: 'Procesado sin alerta', clase: 'badge-ok' }
}

function mensajeError(e) {
  return e.detalle ? `HTTP ${e.detalle.status}: ${e.detalle.diagnostico}` : e.message
}

export default function PestanaMensajeria({ accessToken, emailUsuario }) {
  const hayStreaming = Boolean(config.streamingUrl)
  const hayRabbit = Boolean(config.rabbitUrl)

  const [recibidos, setRecibidos] = useState([])
  const [alertasPipeline, setAlertasPipeline] = useState([])
  const [colas, setColas] = useState([])
  const [alertasRabbit, setAlertasRabbit] = useState([])
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)

  const [formKey, setFormKey] = useState({ key: 'cliente-A', mensaje: 'pedido-manual' })
  const [formPipeline, setFormPipeline] = useState({ cliente: 'ana', monto: 75000, canal: 'web' })
  const [enviadosPipeline, setEnviadosPipeline] = useState([])
  const [formRabbit, setFormRabbit] = useState({ tipo: 'CREADO', monto: 49990, descripcion: 'Pedido demo', simularFallo: 'NINGUNO' })

  // Polling cada 2 s mientras la pestaña está montada; cada panel informa su propio error
  useEffect(() => {
    let vivo = true
    async function leer(nombre, fn, setter) {
      try {
        const res = await fn()
        if (vivo) {
          setter(res)
          setErrores((e) => ({ ...e, [nombre]: null }))
        }
      } catch (e) {
        if (vivo) setErrores((prev) => ({ ...prev, [nombre]: mensajeError(e) }))
      }
    }
    function refrescar() {
      if (hayStreaming) {
        leer('kafka', () => kafkaRecibidos(accessToken), (r) => setRecibidos(r.data || []))
        leer('pipeline', () => pipelineAlertas(accessToken), (r) => setAlertasPipeline(r.data || []))
      }
      if (hayRabbit) {
        leer('rabbit', () => Promise.all(COLAS.map((c) => rabbitCola(accessToken, c))), (rs) => setColas(rs.map((r) => r.data)))
        leer('rabbitAlertas', () => rabbitAlertas(accessToken), (r) => setAlertasRabbit(r.data || []))
      }
    }
    refrescar()
    const id = setInterval(refrescar, INTERVALO_MS)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [accessToken, hayStreaming, hayRabbit])

  async function enviar(descripcion, fn) {
    setAviso(null)
    try {
      await fn()
      setAviso({ ok: true, texto: `${descripcion}: enviado (202). Los paneles se actualizan solos.` })
    } catch (e) {
      setAviso({ ok: false, texto: `${descripcion}: ${mensajeError(e)}` })
    }
  }

  function enviarPipeline(evento) {
    const monto = Number(evento.monto)
    enviar(`Pipeline ${evento.cliente} ${pesos(monto)}`, async () => {
      await pipelineEvento(accessToken, { ...evento, monto })
      setEnviadosPipeline((prev) => [{ ...evento, monto, hora: new Date().toISOString() }, ...prev].slice(0, 10))
    })
  }

  return (
    <>
      <section>
        <h2>Mensajería en vivo</h2>
        <p className="sub">
          Casos simulados contra RabbitMQ y Kafka desplegados en AWS (EC2 + API Gateway con JWT de Cognito).
          Los paneles se actualizan cada {INTERVALO_MS / 1000} s.
        </p>
        {aviso && <p className={aviso.ok ? 'info-box' : 'error'} role="status">{aviso.texto}</p>}
      </section>

      {hayStreaming && (
        <section>
          <h3>Kafka: particiones y offsets (3.2.1)</h3>
          <p className="sub">
            Topic <span className="mono">pedidos-particiones</span>, 3 particiones. Sin key los mensajes rotan entre particiones;
            con key, la misma key cae siempre en la misma columna (mismo color).
          </p>
          <div className="acciones">
            <button className="primario" onClick={() => enviar('Demo Kafka (4 sin key + 5 con key)', () => kafkaDemo(accessToken))}>
              Enviar demo
            </button>
          </div>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              enviar(`Mensaje con key ${formKey.key}`, () => kafkaConKey(accessToken, formKey.key, formKey.mensaje))
            }}
          >
            <div className="form-campo">
              <label htmlFor="kafka-key">Key</label>
              <input id="kafka-key" value={formKey.key} onChange={(e) => setFormKey({ ...formKey, key: e.target.value })} required />
            </div>
            <div className="form-campo">
              <label htmlFor="kafka-mensaje">Mensaje</label>
              <input id="kafka-mensaje" value={formKey.mensaje} onChange={(e) => setFormKey({ ...formKey, mensaje: e.target.value })} required />
            </div>
            <div className="form-campo">
              <label>&nbsp;</label>
              <button type="submit">Enviar con key</button>
            </div>
          </form>
          {errores.kafka && <p className="error">{errores.kafka}</p>}
          <div className="particiones">
            {[0, 1, 2].map((p) => {
              const deEsta = recibidos.filter((r) => r.particion === p).sort((a, b) => b.offset - a.offset).slice(0, 10)
              return (
                <div key={p} className="particion">
                  <h4>Partición {p}</h4>
                  {deEsta.length === 0 && <p className="sub">Sin mensajes</p>}
                  {deEsta.map((r) => (
                    <div key={r.offset} className="mensaje-kafka" style={{ borderLeftColor: colorKey(r.key) }}>
                      <span className="mono">offset {r.offset}</span>
                      <span className="mono" style={{ color: colorKey(r.key) }}>{r.key ?? 'sin key'}</span>
                      <span>{r.value}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {hayStreaming && (
        <section>
          <h3>Kafka Streams: pipeline de alertas (3.2.2)</h3>
          <p className="sub">
            <span className="mono">pedidos-eventos</span> → filtro monto ≥ {pesos(MONTO_MINIMO)} → detección monto &gt; {pesos(MONTO_SOSPECHOSO)} →{' '}
            <span className="mono">pedidos-alertas</span>
          </p>
          <div className="acciones">
            {PRESETS.map((p) => (
              <button key={p.nombre} onClick={() => enviarPipeline(p)}>
                {p.nombre} ({pesos(p.monto)})
              </button>
            ))}
          </div>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              enviarPipeline(formPipeline)
            }}
          >
            <div className="form-campo">
              <label htmlFor="pl-cliente">Cliente</label>
              <input id="pl-cliente" value={formPipeline.cliente} onChange={(e) => setFormPipeline({ ...formPipeline, cliente: e.target.value })} required />
            </div>
            <div className="form-campo">
              <label htmlFor="pl-monto">Monto</label>
              <input id="pl-monto" type="number" min="0" value={formPipeline.monto} onChange={(e) => setFormPipeline({ ...formPipeline, monto: e.target.value })} required />
            </div>
            <div className="form-campo">
              <label htmlFor="pl-canal">Canal</label>
              <select id="pl-canal" value={formPipeline.canal} onChange={(e) => setFormPipeline({ ...formPipeline, canal: e.target.value })}>
                <option value="web">web</option>
                <option value="app">app</option>
                <option value="sucursal">sucursal</option>
              </select>
            </div>
            <div className="form-campo">
              <label>&nbsp;</label>
              <button type="submit">Enviar evento</button>
            </div>
          </form>
          {errores.pipeline && <p className="error">{errores.pipeline}</p>}
          <div className="dos-columnas">
            <div>
              <h4>Eventos enviados (esta sesión)</h4>
              {enviadosPipeline.length === 0 && <p className="sub">Usa un preset o el formulario.</p>}
              {enviadosPipeline.map((ev) => {
                const esperado = esperadoPipeline(ev.monto)
                return (
                  <div key={ev.hora} className="mensaje-kafka">
                    <span>{hora(ev.hora)} · {ev.cliente} · {ev.canal}</span>
                    <span className="mono">{pesos(ev.monto)}</span>
                    <span className={`badge ${esperado.clase}`}>{esperado.texto}</span>
                  </div>
                )
              })}
            </div>
            <div>
              <h4>Alertas en pedidos-alertas</h4>
              {alertasPipeline.length === 0 && <p className="sub">Sin alertas todavía.</p>}
              {alertasPipeline.slice(0, 10).map((a) => (
                <div key={`${a.particion}-${a.offset}`} className="mensaje-kafka alerta">
                  <span>{hora(a.hora)} · {a.alerta.cliente}</span>
                  <span className="mono">{pesos(a.alerta.monto)}</span>
                  <span>{a.alerta.motivo}</span>
                  <span className="badge badge-mal">{a.alerta.severidad}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {hayRabbit && (
        <section>
          <h3>RabbitMQ: eventos de pedido, colas y DLQ (EP3)</h3>
          <p className="sub">
            Cada evento se enruta a notificaciones, tickets y documentos. Con fallo TRANSITORIO se reintenta; con PERMANENTE va a la DLQ.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              const evento = {
                pedidoId: Date.now() % 1000000,
                clienteEmail: emailUsuario || 'demo@pedidos360.cl',
                descripcion: formRabbit.descripcion,
                monto: Number(formRabbit.monto),
                tipo: formRabbit.tipo,
                simularFallo: formRabbit.simularFallo,
              }
              enviar(`Evento RabbitMQ #${evento.pedidoId} (${evento.tipo}, fallo ${evento.simularFallo})`, () => rabbitPublicar(accessToken, evento))
            }}
          >
            <div className="form-campo">
              <label htmlFor="rb-tipo">Tipo</label>
              <select id="rb-tipo" value={formRabbit.tipo} onChange={(e) => setFormRabbit({ ...formRabbit, tipo: e.target.value })}>
                <option value="CREADO">CREADO</option>
                <option value="ACTUALIZADO">ACTUALIZADO</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>
            </div>
            <div className="form-campo">
              <label htmlFor="rb-monto">Monto</label>
              <input id="rb-monto" type="number" min="0" value={formRabbit.monto} onChange={(e) => setFormRabbit({ ...formRabbit, monto: e.target.value })} required />
            </div>
            <div className="form-campo">
              <label htmlFor="rb-desc">Descripción</label>
              <input id="rb-desc" maxLength={255} value={formRabbit.descripcion} onChange={(e) => setFormRabbit({ ...formRabbit, descripcion: e.target.value })} required />
            </div>
            <div className="form-campo">
              <label htmlFor="rb-fallo">Simular fallo</label>
              <select id="rb-fallo" value={formRabbit.simularFallo} onChange={(e) => setFormRabbit({ ...formRabbit, simularFallo: e.target.value })}>
                <option value="NINGUNO">NINGUNO</option>
                <option value="TRANSITORIO">TRANSITORIO (reintento)</option>
                <option value="PERMANENTE">PERMANENTE (a DLQ)</option>
              </select>
            </div>
            <div className="form-campo">
              <label>&nbsp;</label>
              <button type="submit" className="primario">Publicar evento</button>
            </div>
          </form>
          {errores.rabbit && <p className="error">{errores.rabbit}</p>}
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Cola</th>
                  <th>Mensajes en espera</th>
                  <th>Consumidores</th>
                </tr>
              </thead>
              <tbody>
                {colas.map((c) => {
                  const dlqConMensajes = c.nombre.endsWith('.dlq') && c.mensajes > 0
                  return (
                    <tr key={c.nombre}>
                      <td className="mono">{c.nombre}</td>
                      <td>
                        <span className={`badge ${dlqConMensajes ? 'badge-mal' : 'badge-ok'}`}>{c.mensajes}</span>
                      </td>
                      <td>{c.consumidores}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <h4>Alertas del monitoreo (rabbit-admin-ms)</h4>
          {errores.rabbitAlertas && <p className="error">{errores.rabbitAlertas}</p>}
          {alertasRabbit.length === 0 && <p className="sub">Sin alertas: colas sanas.</p>}
          {alertasRabbit.map((a) => (
            <div key={`${a.cola}-${a.mensaje}`} className="mensaje-kafka alerta">
              <span className={`badge ${a.nivel === 'CRITICAL' ? 'badge-mal' : 'badge-aviso'}`}>{a.nivel}</span>
              <span className="mono">{a.cola}</span>
              <span>{a.mensaje}</span>
            </div>
          ))}
        </section>
      )}
    </>
  )
}
