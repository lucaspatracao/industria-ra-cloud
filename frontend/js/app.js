document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     0. CONFIGURAÇÃO DA API
     ?api=https://... na URL sobrescreve o valor de config.js
     (útil quando o endereço do túnel muda a cada demonstração).
     ========================================================= */
  const CONFIG = window.APP_CONFIG || {};
  const apiParam = new URLSearchParams(window.location.search).get("api");
  const apiEscolhida =
    apiParam && /^https?:\/\//i.test(apiParam) ? apiParam : CONFIG.API_BASE_URL;

  const API_BASE = String(apiEscolhida || "").replace(/\/+$/, "");
  const EQUIPAMENTO_ID = CONFIG.EQUIPAMENTO_ID || "CNC-01";
  const REQUEST_TIMEOUT_MS = 5000;

  /* =========================================================
     1. REFERÊNCIAS À CENA DE RA
     ========================================================= */
  const scene = document.querySelector("#ar-scene");
  const target = document.querySelector("#target");
  const cameraElement = document.querySelector("#ar-camera");

  /* =========================================================
     2. REFERÊNCIAS À INTERFACE
     ========================================================= */
  const status = document.querySelector("#status");
  const badge = document.querySelector("#badge");
  const panel = document.querySelector("#info-panel");
  const panelTitle = document.querySelector("#info-title");
  const panelText = document.querySelector("#info-text");
  const panelDetail = document.querySelector("#info-detail");
  const closeButton = document.querySelector("#close-panel");

  const telemetryBox = document.querySelector("#telemetry");
  const tmAtivo = document.querySelector("#tm-ativo");
  const tmStatus = document.querySelector("#tm-status");
  const tmTemp = document.querySelector("#tm-temp");
  const tmVib = document.querySelector("#tm-vib");
  const tmAtual = document.querySelector("#tm-atual");
  const panelError = document.querySelector("#panel-error");
  const refreshButton = document.querySelector("#refresh-button");

  const hotspots = Array.from(document.querySelectorAll(".hotspot"));

  let tracking = false;

  /* Cada consulta recebe um número. Se o usuário fechar o painel ou tocar
     em outro ponto enquanto a resposta não chega, a resposta antiga é
     descartada (evita mostrar dados no painel errado). */
  let requestCounter = 0;

  /* =========================================================
     3. CONTEÚDO ESTÁTICO (pertence à interface)
     A chave deve ser igual ao data-topic do botão.
     dynamic: true => além do texto, consulta a API.
     ========================================================= */
  const information = {
    placa: {
      title: "Cabeçote e placa",
      text: "A placa fixa a peça e o cabeçote fornece o movimento de rotação necessário ao torneamento.",
      detail: "A fixação correta é essencial para precisão e segurança."
    },
    torre: {
      title: "Torre de ferramentas",
      text: "A torre organiza as ferramentas de corte e permite selecionar a ferramenta necessária em cada etapa do programa CNC.",
      detail: "A indexação da torre pode integrar a sequência automática de usinagem."
    },
    comando: {
      title: "Painel de comando CNC",
      text: "O painel é a interface entre operador, programa CNC e sistema de controle da máquina.",
      detail: "Os dados apresentados nesta experiência são didáticos."
    },
    seguranca: {
      title: "Proteção e segurança",
      text: "Portas, proteções e intertravamentos ajudam a separar o operador da região de usinagem.",
      detail: "A Realidade Aumentada não substitui treinamento ou documentação do fabricante."
    },
    monitoramento: {
      title: "Monitoramento",
      text: "Dados operacionais obtidos em tempo real da API Flask, alimentada por telemetria MQTT.",
      detail: "Valores SIMULADOS, apenas didáticos. Não representam limites reais de segurança ou manutenção.",
      dynamic: true
    }
  };

  /* =========================================================
     4. PAINEL
     ========================================================= */
  function resetDynamicArea() {
    telemetryBox.classList.add("hidden");
    panelError.classList.add("hidden");
    refreshButton.classList.add("hidden");
    refreshButton.disabled = false;
    refreshButton.textContent = "Atualizar";
  }

  function showInformation(topicName) {
    const selected = information[topicName];

    if (!selected) {
      return;
    }

    requestCounter++;          /* invalida consulta pendente */
    resetDynamicArea();

    panelTitle.textContent = selected.title;
    panelText.textContent = selected.text;
    panelDetail.textContent = selected.detail;

    panel.classList.remove("hidden");

    if (selected.dynamic) {
      loadMonitoring();
    }
  }

  function hideInformation() {
    requestCounter++;
    panel.classList.add("hidden");
  }

  /* =========================================================
     5. CONSULTA À API (HTTP GET + JSON)
     ========================================================= */
  async function fetchJson(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: {
          "Accept": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function formatValue(value, unit) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "—";
    }
    return `${Number(value).toFixed(1)} ${unit}`;
  }

  function renderTelemetry(identification, telemetry) {
    tmAtivo.textContent =
      `${identification.id} • ${identification.tipo} • ${identification.setor}`;
    tmStatus.textContent = telemetry.status ?? "—";
    tmTemp.textContent = formatValue(telemetry.temperatura, "°C");
    tmVib.textContent = formatValue(telemetry.vibracao, "mm/s");
    tmAtual.textContent = telemetry.atualizacao ?? "—";
  }

  async function loadMonitoring() {
    const requestId = ++requestCounter;

    panelError.classList.add("hidden");
    telemetryBox.classList.remove("hidden");
    refreshButton.classList.remove("hidden");
    refreshButton.disabled = true;
    refreshButton.textContent = "Consultando...";

    try {
      const base = `/api/equipamentos/${encodeURIComponent(EQUIPAMENTO_ID)}`;

      const [identification, telemetry] = await Promise.all([
        fetchJson(base),
        fetchJson(`${base}/telemetria`)
      ]);

      if (requestId !== requestCounter) {
        return;                /* resposta antiga: descarta */
      }

      renderTelemetry(identification, telemetry);
    } catch (error) {
      if (requestId !== requestCounter) {
        return;
      }

      console.error("Falha ao consultar a API:", error);

      /* Não mostra dados antigos como se fossem atuais. */
      telemetryBox.classList.add("hidden");
      panelError.classList.remove("hidden");
    } finally {
      if (requestId === requestCounter) {
        refreshButton.disabled = false;
        refreshButton.textContent = "Atualizar";
      }
    }
  }

  /* =========================================================
     6. EVENTOS DE INTERAÇÃO
     ========================================================= */
  hotspots.forEach((button) => {
    button.addEventListener("pointerup", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showInformation(button.dataset.topic);
    });
  });

  closeButton.addEventListener("pointerup", (event) => {
    event.preventDefault();
    hideInformation();
  });

  refreshButton.addEventListener("pointerup", (event) => {
    event.preventDefault();
    event.stopPropagation();
    loadMonitoring();
  });

  /* =========================================================
     7. EVENTOS DO MINDAR
     ========================================================= */
  scene.addEventListener("arReady", () => {
    status.textContent = "Câmera pronta. Aponte para a imagem do torno.";
    badge.textContent = "PROCURANDO ALVO";
  });

  scene.addEventListener("arError", () => {
    status.textContent = "Não foi possível iniciar a câmera.";
    badge.textContent = "ERRO";
  });

  target.addEventListener("targetFound", () => {
    tracking = true;

    status.textContent = "Torno reconhecido. Toque em um ponto numerado.";
    badge.textContent = "● RA ATIVA";

    hotspots.forEach((button) => {
      button.classList.add("visible");
    });
  });

  target.addEventListener("targetLost", () => {
    tracking = false;

    status.textContent = "Alvo perdido. Aponte novamente para a imagem.";
    badge.textContent = "PROCURANDO ALVO";

    hotspots.forEach((button) => {
      button.classList.remove("visible");
    });

    hideInformation();
  });

  /* =========================================================
     8. POSIÇÃO 3D -> 2D
     local -> mundo -> projeção -> pixels
     ========================================================= */
  function updateHotspotPositions() {
    requestAnimationFrame(updateHotspotPositions);

    if (!tracking) {
      return;
    }

    const camera = cameraElement.getObject3D("camera");

    if (!camera || !target.object3D) {
      return;
    }

    target.object3D.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    hotspots.forEach((button) => {
      const localPoint = new THREE.Vector3(
        Number(button.dataset.x),
        Number(button.dataset.y),
        Number(button.dataset.z)
      );

      const worldPoint = target.object3D.localToWorld(localPoint);
      const projectedPoint = worldPoint.clone().project(camera);

      const screenX = (projectedPoint.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-projectedPoint.y * 0.5 + 0.5) * window.innerHeight;

      button.style.left = `${screenX}px`;
      button.style.top = `${screenY}px`;

      const insideScreen =
        projectedPoint.z > -1 &&
        projectedPoint.z < 1 &&
        screenX > -80 &&
        screenX < window.innerWidth + 80 &&
        screenY > -80 &&
        screenY < window.innerHeight + 80;

      button.style.visibility = insideScreen ? "visible" : "hidden";
    });
  }

  updateHotspotPositions();

});
