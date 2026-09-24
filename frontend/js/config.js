/*
 * Configuração da aplicação WebAR.
 *
 * API_BASE_URL:
 *   - Teste no PC:  http://localhost:5000
 *   - No celular (página em HTTPS): use a URL HTTPS do túnel
 *     (ex.: https://xxxx.trycloudflare.com), pois o navegador bloqueia
 *     uma página HTTPS que chama uma API HTTP (mixed content).
 *   - Alternativa sem editar/publicar: abra a página com ?api=https://...
 *
 * Sem barra no final.
 */
window.APP_CONFIG = {
  API_BASE_URL: "http://localhost:5000",
  EQUIPAMENTO_ID: "ROBO-01"
};
