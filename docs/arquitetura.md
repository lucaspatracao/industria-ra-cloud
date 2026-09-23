# Arquitetura

Para gerar `arquitetura.png`: cole o bloco abaixo em https://mermaid.live e exporte como PNG.

```mermaid
flowchart TD
    A["Torno CNC + target visual"] -->|câmera do celular| B["WebAR<br/>HTML + CSS + JS<br/>A-Frame + MindAR<br/>GitHub Pages (HTTPS)"]
    B -->|"HTTP / JSON (fetch)"| T["Túnel HTTPS<br/>(cloudflared / ngrok)"]
    T --> C["API Flask :5000"]
    D["Broker MQTT Mosquitto :1883"] -->|"assina industria/CNC-01/#"| C
    E["Simulador (publisher)"] -->|"publica temperatura, vibração, status"| D
    subgraph DC["Docker Compose"]
        C
        D
        E
    end
```

## Fluxo de dados

1. O simulador publica em `industria/CNC-01/temperatura|vibracao|status` (com `retain`).
2. O broker entrega as mensagens à API (subscriber).
3. A API guarda o último valor em memória.
4. O usuário toca no hotspot 5; o frontend faz `GET /api/equipamentos/CNC-01` e `.../telemetria`.
5. O painel exibe os dados ou a mensagem de indisponibilidade.
