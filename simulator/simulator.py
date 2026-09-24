"""
Simulador de telemetria (publisher MQTT) - DADOS FICTÍCIOS E DIDÁTICOS.

Publica periodicamente:
  industria/<ID>/temperatura
  industria/<ID>/vibracao
  industria/<ID>/status

Os intervalos usados abaixo servem apenas para gerar variação na simulação.
Não são limites reais de segurança ou de manutenção.
"""

import os
import random
import signal
import time

import paho.mqtt.client as mqtt

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
TOPIC_ROOT = os.getenv("MQTT_TOPIC_ROOT", "industria")
EQUIPAMENTO_ID = os.getenv("EQUIPAMENTO_ID", "ROBO-01")
INTERVALO_S = float(os.getenv("INTERVALO_S", "3"))

executando = True


def log(mensagem):
    print(mensagem, flush=True)


def encerrar(signum, frame):
    global executando
    executando = False


def conectar():
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"simulador-{EQUIPAMENTO_ID}",
    )
    # Enquanto o broker não estiver pronto, tenta novamente.
    while executando:
        try:
            client.connect(MQTT_HOST, MQTT_PORT, keepalive=30)
            break
        except OSError as erro:
            log(f"Broker indisponível ({erro}). Nova tentativa em 2 s...")
            time.sleep(2)
    client.loop_start()  # reconexões automáticas depois de conectado
    return client


def limitar(valor, minimo, maximo):
    return max(minimo, min(maximo, valor))


def publicar(client, campo, valor):
    topico = f"{TOPIC_ROOT}/{EQUIPAMENTO_ID}/{campo}"
    # retain=True: quem assinar depois (ex.: API reiniciada) recebe o último valor.
    client.publish(topico, valor, qos=1, retain=True)
    log(f"publicado {topico} = {valor}")


def main():
    signal.signal(signal.SIGTERM, encerrar)
    signal.signal(signal.SIGINT, encerrar)

    client = conectar()
    temperatura = 42.0
    vibracao = 2.3

    while executando:
        temperatura = limitar(temperatura + random.uniform(-0.6, 0.6), 38.0, 52.0)
        vibracao = limitar(vibracao + random.uniform(-0.15, 0.15), 1.5, 3.5)
        status = random.choices(["operando", "em espera"], weights=[85, 15])[0]

        publicar(client, "temperatura", f"{temperatura:.1f}")
        publicar(client, "vibracao", f"{vibracao:.1f}")
        publicar(client, "status", status)

        # Espera em passos curtos para reagir rápido ao docker stop.
        espera = 0.0
        while executando and espera < INTERVALO_S:
            time.sleep(0.2)
            espera += 0.2

    client.loop_stop()
    client.disconnect()
    log("Simulador encerrado.")


if __name__ == "__main__":
    main()
