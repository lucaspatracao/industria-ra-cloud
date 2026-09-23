# Matriz de testes

Preencha **Resultado obtido**, **Status** (OK / FALHOU) e **Evidência** (print, vídeo, saída de terminal) ao executar cada teste.

| ID | Ação | Resultado esperado | Como executar | Resultado obtido | Status | Evidência |
|---|---|---|---|---|---|---|
| T01 | Abrir WebAR | Câmera disponível | Abrir a URL HTTPS no celular e permitir a câmera | | | |
| T02 | Apontar para o target | Estado RA ATIVA | Apontar para a imagem; badge muda para "● RA ATIVA" | | | |
| T03 | Movimentar celular/target | Hotspots acompanham o ativo | Mover lentamente o celular | | | |
| T04 | Tocar hotspot técnico (1–4) | Informação estática apresentada | Tocar em cada número | | | |
| T05 | Tocar Monitoramento (5) | API consultada e JSON apresentado | Tocar no ponto 5; conferir status, temperatura, vibração e horário | | | |
| T06 | Publicar novo valor MQTT | Serviço recebe/atualiza o dado | `docker compose stop simulator` e `docker compose exec mqtt mosquitto_pub -t industria/CNC-01/temperatura -m 99.9 -r` | | | |
| T07 | Consultar novamente | Novo valor é apresentado na RA | Tocar em **Atualizar** no painel; deve exibir 99.9 °C | | | |
| T08 | Parar a API | Mensagem de indisponibilidade | `docker compose stop api` e tocar em **Atualizar** | | | |
| T09 | Restaurar a API | Consulta volta a funcionar | `docker compose start api` e tocar em **Atualizar** | | | |

## Testes complementares (recomendados)

| ID | Ação | Resultado esperado |
|---|---|---|
| T10 | `GET /api/equipamentos/XYZ` | HTTP 404 com `{"erro": ...}` |
| T11 | Parar o broker (`docker compose stop mqtt`) | API continua respondendo o último valor; `/api/health` mostra `mqtt_conectado: false` |
| T12 | Religar o broker (`docker compose start mqtt`) | API reconecta sozinha; `mqtt_conectado: true` |
| T13 | Tocar em outro hotspot durante uma consulta lenta | Painel não mostra dados do ponto anterior |
