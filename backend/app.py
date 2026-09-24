"""
API Flask - Sistema de Apoio à Manutenção Industrial (protótipo didático).

Responsabilidades:
  1. Expor dados de identificação e telemetria por HTTP/JSON (consumidos pela WebAR).
  2. Assinar tópicos MQTT e guardar o ÚLTIMO valor recebido de cada grandeza.

Todos os valores são SIMULADOS e didáticos. Não representam limites reais
de segurança ou de manutenção de nenhuma máquina.

Onde o último dado fica armazenado? Em memória, no dicionário `telemetria`
deste processo. Por isso o Gunicorn roda com 1 worker (ver Dockerfile).
"""

import logging
import math
import os
import threading
from datetime import datetime
from zoneinfo import ZoneInfo

import paho.mqtt.client as mqtt
from flask import Flask, jsonify

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("api")

# ---------------------------------------------------------------------------
# Configuração (variáveis de ambiente, com valores padrão para uso local)
# ---------------------------------------------------------------------------
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
TOPIC_ROOT = os.getenv("MQTT_TOPIC_ROOT", "industria")
FUSO = ZoneInfo(os.getenv("TZ_NAME", "America/Sao_Paulo"))

# ---------------------------------------------------------------------------
# Dados do protótipo
# ---------------------------------------------------------------------------
EQUIPAMENTOS = {
    "ROBO-01": {
        "id": "ROBO-01",
        "tipo": "Robô Industrial",
        "setor": "Manufatura",
        "status": "operacional",
    },
}

CAMPOS_NUMERICOS = {"temperatura", "vibracao"}
CAMPOS_TEXTO = {"status"}

telemetria = {
    equipamento_id: {
        "temperatura": None,
        "vibracao": None,
        "status": "sem dados",
        "atualizacao": None,
    }
    for equipamento_id in EQUIPAMENTOS
}

# O cliente MQTT roda em outra thread; o lock evita leitura/escrita simultânea.
trava = threading.Lock()
estado_mqtt = {"conectado": False}


# ---------------------------------------------------------------------------
# MQTT (subscriber)
# ---------------------------------------------------------------------------
def ao_conectar(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        log.error("Falha ao conectar no broker MQTT: %s", reason_code)
        return
    estado_mqtt["conectado"] = True
    log.info("Conectado ao broker MQTT em %s:%s", MQTT_HOST, MQTT_PORT)
    # Assinar dentro de on_connect garante a reassinatura após reconexões.
    client.subscribe(f"{TOPIC_ROOT}/+/+")


def ao_desconectar(client, userdata, disconnect_flags, reason_code, properties):
    estado_mqtt["conectado"] = False
    log.warning("Desconectado do broker MQTT (%s). Tentando reconectar...", reason_code)


def ao_receber_mensagem(client, userdata, msg):
    partes = msg.topic.split("/")
    if len(partes) != 3 or partes[0] != TOPIC_ROOT:
        return

    _, equipamento_id, campo = partes
    if equipamento_id not in telemetria:
        return

    try:
        texto = msg.payload.decode("utf-8").strip()
    except UnicodeDecodeError:
        log.warning("Payload inválido (não é UTF-8) em %s", msg.topic)
        return

    if campo in CAMPOS_NUMERICOS:
        try:
            valor = float(texto)
        except ValueError:
            log.warning("Valor não numérico em %s: %r", msg.topic, texto)
            return
        if not math.isfinite(valor):
            log.warning("Valor não finito em %s: %r", msg.topic, texto)
            return
        valor = round(valor, 1)
    elif campo in CAMPOS_TEXTO:
        valor = texto[:30]
    else:
        return

    with trava:
        telemetria[equipamento_id][campo] = valor
        telemetria[equipamento_id]["atualizacao"] = datetime.now(FUSO).strftime("%H:%M:%S")

    log.info("MQTT %s = %s", msg.topic, valor)


def iniciar_mqtt():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="api-flask")
    client.on_connect = ao_conectar
    client.on_disconnect = ao_desconectar
    client.on_message = ao_receber_mensagem
    client.reconnect_delay_set(min_delay=1, max_delay=10)
    # connect_async + loop_start: se o broker ainda não subiu, tenta de novo sozinho.
    client.connect_async(MQTT_HOST, MQTT_PORT, keepalive=30)
    client.loop_start()
    return client


mqtt_client = iniciar_mqtt()

# ---------------------------------------------------------------------------
# API HTTP/JSON
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.json.ensure_ascii = False


@app.after_request
def cabecalhos(resposta):
    # CORS: a WebAR é servida de outra origem (GitHub Pages).
    # Para produção, troque "*" pela origem exata do frontend.
    resposta.headers["Access-Control-Allow-Origin"] = "*"
    resposta.headers["Access-Control-Allow-Headers"] = (
        "Content-Type, Accept, ngrok-skip-browser-warning"
    )
    resposta.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    resposta.headers["Cache-Control"] = "no-store"
    return resposta


@app.get("/api/health")
def health():
    return jsonify({"api": "ok", "mqtt_conectado": estado_mqtt["conectado"]})


@app.get("/api/equipamentos/<equipamento_id>")
def identificacao(equipamento_id):
    equipamento = EQUIPAMENTOS.get(equipamento_id)
    if equipamento is None:
        return jsonify({"erro": "Equipamento não encontrado"}), 404
    return jsonify(equipamento)


@app.get("/api/equipamentos/<equipamento_id>/telemetria")
def obter_telemetria(equipamento_id):
    if equipamento_id not in telemetria:
        return jsonify({"erro": "Equipamento não encontrado"}), 404
    with trava:
        copia = dict(telemetria[equipamento_id])
    return jsonify(copia)


if __name__ == "__main__":
    # Execução local sem Docker: python app.py
    app.run(host="0.0.0.0", port=5000)
