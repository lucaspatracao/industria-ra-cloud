# Análises técnicas

> Texto-base. Reescreva com as palavras da equipe e adapte ao que foi de fato implementado.
> Todos os dados de monitoramento são simulados e didáticos.

## 1. Planejamento dos dados (Etapa 2)

| Dado | Onde fica | Justificativa |
|---|---|---|
| Nome, descrição e função dos componentes | Frontend (`information` em `app.js`) | Muda raramente e não depende do estado da máquina. Ficar no cliente reduz chamadas e funciona mesmo sem a API. |
| Status, temperatura, vibração, última atualização | Serviço (API Flask, alimentada por MQTT) | Mudam o tempo todo. Se estivessem no `app.js`, ficariam desatualizados e exigiriam nova publicação do frontend a cada mudança. |

Decisão 1: conteúdo didático fica na interface (estático, independente da operação).
Decisão 2: telemetria vem do serviço (dinâmica, precisa de fonte única e atualizada).

## 2. Qual problema o container resolve? (Etapa 7)

Além de "executar o Flask":

- **Reprodutibilidade:** a imagem carrega Python, dependências fixadas (`requirements.txt`) e o código. Funciona igual na máquina de qualquer integrante, no laboratório e em um servidor.
- **Isolamento:** as dependências da API não conflitam com as do simulador nem com o Python instalado no computador.
- **Padronização da execução:** um comando (`docker compose up`) sobe API, broker e simulador, sem instalar Mosquitto ou configurar ambiente manualmente.
- **Portabilidade para a nuvem:** a mesma imagem pode ser executada em uma VM (IaaS) ou enviada a uma plataforma que execute containers (PaaS).

## 3. Containers do projeto

| Container | Imagem | Função |
|---|---|---|
| `ra-mqtt` | `eclipse-mosquitto:2` | Broker MQTT |
| `ra-api` | build de `./backend` | API Flask + subscriber MQTT |
| `ra-simulator` | build de `./simulator` | Publisher de telemetria fictícia |

O frontend **não** roda em container: é um site estático publicado no GitHub Pages.

## 4. IaaS, PaaS e SaaS (Etapa 9)

| Cenário | Modelo | Responsabilidades |
|---|---|---|
| A empresa contrata uma VM Linux e instala Docker, Flask e MQTT | **IaaS** | **Provedor:** hardware, rede física, virtualização. **Empresa:** sistema operacional, atualizações e segurança do SO, Docker, Compose, broker, API, dados, firewall/portas, monitoramento e backup. |
| A equipe envia a aplicação para uma plataforma que administra infraestrutura e ambiente de execução | **PaaS** | **Provedor:** servidores, SO, runtime, escalabilidade e parte da operação. **Equipe deixa de administrar** o SO e a máquina; continua responsável pelo código, configuração, dados e pelas dependências da aplicação. |
| O técnico apenas acessa uma aplicação pronta pelo navegador | **SaaS (sob a ótica do usuário)** | **Provedor:** aplicação, plataforma e infraestrutura. **Usuário:** usa o software, gerencia suas contas/permissões e o conteúdo que insere. Ele não instala nem opera nada. |

Observação: no protótipo, o GitHub Pages hospeda o frontend estático como um serviço gerenciado (o provedor cuida da infraestrutura de hospedagem). Já a API roda na máquina da equipe, então a equipe administra tudo.

## 5. Respostas para a apresentação (Seção 19)

- **Onde está executando o Flask?** No container `ra-api`, na máquina/VM que executa o Compose (exposto pela porta 5000 e, para o celular, por um túnel HTTPS).
- **Função do broker MQTT?** Desacoplar quem publica de quem consome: o simulador (ou uma máquina real/gateway) publica em tópicos, e a API assina, sem se conhecerem diretamente.
- **Por que a WebAR usa HTTP/JSON?** É simples, universal no navegador (`fetch`), fácil de tratar erros e evita expor o broker ao celular. A API concentra o acesso aos dados.
- **Qual serviço está em cada container?** Ver tabela da seção 3.
- **Se o broker ficar indisponível?** A API continua respondendo o último valor em memória (que envelhece); `/api/health` indica `mqtt_conectado: false`. Ao voltar, a API reconecta e reassina os tópicos.
- **Onde fica o último dado?** Em memória, no dicionário `telemetria` do processo Flask (e, como mensagem retida, no broker enquanto ele estiver ativo).
- **Como os hotspots acompanham o target?** Posição local (`data-*`) → `localToWorld()` → `project(camera)` → pixels → `left/top`, a cada quadro via `requestAnimationFrame`.
- **Target físico × `.mind`?** O target é a imagem impressa/exibida no mundo real; o `.mind` é o arquivo com as características dessa imagem, já processadas, que o MindAR usa para reconhecê-la.
- **O que escalar se muitos usuários consultarem?** A API (várias réplicas atrás de um balanceador). Isso exige tirar o estado da memória do processo, por exemplo para Redis ou banco, e cada réplica lê do mesmo lugar.
- **Em qual cenário IaaS é mais adequado?** Quando a equipe precisa de controle total do ambiente (broker, portas, Compose) — cenário da VM Linux.
- **O que muda em PaaS?** Deixa-se de administrar SO e servidor; a plataforma executa o container ou o código. O broker costuma virar um serviço gerenciado separado, e as variáveis de ambiente/URLs passam a ser configuradas na plataforma.
- **O que continua funcionando se a API parar?** Câmera, reconhecimento do target, hotspots e todo o conteúdo estático (pontos 1 a 4). Só o monitoramento exibe a mensagem de indisponibilidade.
