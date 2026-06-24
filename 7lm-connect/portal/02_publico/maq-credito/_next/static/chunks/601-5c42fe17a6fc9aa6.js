(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[601],{1221:(e,a,o)=>{"use strict";o.d(a,{default:()=>m});var t=o(5155),i=o(2115),n=o(4645);let d=String.raw`:root {
      --bg: #0f172a;
      --card: #ffffff;
      --card-soft: #f8fafc;
      --accent: #22c55e;
      --accent-soft: rgba(34, 197, 94, 0.15);
      --accent-dark: #16a34a;
      --text: #0f172a;
      --text-soft: #475569;
      --danger: #ef4444;
      --warning: #f97316;
      --info: #0ea5e9;
      --border: #cbd5e1;
      --shadow: 0 18px 38px rgba(15, 23, 42, 0.12);
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    * {
      box-sizing: border-box;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      margin: 0;
      background: #ffffff;
      color: var(--text);
      min-height: 100vh;
    }

    .hidden {
      display: none !important;
    }

    .app-container {
      max-width: 1120px;
      margin: 0 auto;
      padding: 24px 16px 40px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .topbar-left h1 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .topbar-left h1 i {
      color: var(--accent);
    }

    .topbar-left .badge {
      font-size: 0.8rem;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.15);
      color: var(--accent);
      border: 1px solid rgba(34, 197, 94, 0.4);
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 600;
      display: inline-block;
      margin-top: 8px;
    }

    .topbar-left .subtitle {
      color: var(--text-soft);
      font-size: 0.9rem;
      margin-top: 6px;
    }

    .topbar-right {
      font-size: 0.85rem;
      color: #334155;
      background: #ffffff;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .topbar-right strong {
      color: var(--accent);
    }

    .topbar-right .user-line {
      font-size: 0.8rem;
      color: #475569;
      margin-top: 4px;
    }

    .btn-voltar-acompanhamento {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      margin-top: 8px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid rgba(34, 197, 94, 0.38);
      background: rgba(34, 197, 94, 0.12);
      color: #166534;
      font-weight: 800;
      font-size: 0.82rem;
      text-decoration: none;
      white-space: nowrap;
    }

    .grid {
      display: grid;
      grid-template-columns: 2fr 1.4fr;
      gap: 20px;
    }

    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
      
      .topbar {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    .card {
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      padding: 20px 24px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      transition: var(--transition);
    }

    .card:hover {
      border-color: rgba(15, 23, 42, 0.22);
      box-shadow: 0 22px 36px rgba(15, 23, 42, 0.16);
    }

    .card h2 {
      color: #0f172a;
      font-size: 1.2rem;
      margin: 0 0 6px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .card h2 i {
      color: var(--accent);
    }

    .card small {
      color: #475569;
      font-size: 0.8rem;
      line-height: 1.5;
    }

    .section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px dashed rgba(15, 23, 42, 0.22);
    }

    .section-title {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #334155;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .section-title span.pill {
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      padding: 4px 12px;
      font-size: 0.75rem;
      color: #334155;
      background: #f8fafc;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 16px;
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.85rem;
    }

    label {
      color: #334155;
      font-weight: 500;
    }

    input, select {
      background: var(--card-soft);
      border-radius: 10px;
      border: 1px solid var(--border);
      padding: 10px 12px;
      color: var(--text);
      font-size: 0.85rem;
      outline: none;
      transition: var(--transition);
    }

    input:focus, select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
    }

    .input-error {
      border-color: var(--danger) !important;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
    }

    input[readonly] {
      background: #f1f5f9;
      color: #475569;
    }

    .hint {
      font-size: 0.75rem;
      color: #475569;
      line-height: 1.6;
      margin-top: 6px;
    }

    .hint i {
      margin-right: 4px;
      color: var(--accent);
    }

    .hint strong {
      color: var(--accent);
      font-weight: 600;
    }

    .rules-list {
      background: #f8fafc;
      color: #334155;
      border-radius: 10px;
      padding: 14px;
      margin-top: 12px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-left: 3px solid var(--accent);
    }

    .rules-list ul {
      margin: 0;
      padding-left: 18px;
    }

    .rules-list li {
      margin-bottom: 6px;
      font-size: 0.8rem;
    }

    .status-dots {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
      font-size: 0.8rem;
      margin-top: 8px;
    }

    .dot-label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 8px;
      background: #f8fafc;
      color: #334155;
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }

    .dot.nao-enviado { background: #9ca3af; box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.2); }
    .dot.em-analise { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2); }
    .dot.aprovado { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2); }
    .dot.rejeitado { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }
    .dot.pendenciado { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }
    .dot.reprovado { background: #020617; border: 1px solid #4b5563; }

    .file-row {
      display: block;
      padding: 14px 16px 14px 14px;
      border: 1px solid rgba(148, 163, 184, .24);
      border-left: 4px solid #cbd5e1;
      border-radius: 12px;
      background: #ffffff;
      margin-bottom: 12px;
      transition: var(--transition);
    }
    .file-row[data-status="pendenciado"] { border-left-color: #ef4444; }
    .file-row[data-status="enviado"] { border-left-color: #0ea5e9; }
    .file-row[data-status="aprovado"] { border-left-color: #22c55e; }
    .file-row[data-status="em-analise"] { border-left-color: #f59e0b; }

    .file-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: start;
    }

    .file-info {
      min-width: 0;
    }

    .file-row-title {
      color: #0f172a;
      font-size: 0.88rem;
      font-weight: 900;
      display: block;
      gap: 8px;
    }

    .file-row-title i {
      color: var(--accent);
    }

    .file-row-desc {
      display: block;
      margin-top: 4px;
      font-size: 0.75rem;
      color: #475569;
      line-height: 1.35;
    }

    .file-upload-action {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      font-size: 0.75rem;
    }

    .btn-upload {
      border-radius: 999px;
      min-height: 34px;
      padding: 0 13px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.2));
      border: 1px solid rgba(34, 197, 94, 0.5);
      color: var(--accent);
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: var(--transition);
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    .btn-upload:hover {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.3));
      border-color: var(--accent);
    }

    .btn-upload.uploaded {
      background: rgba(34, 197, 94, 0.2);
      border-color: var(--accent);
      color: var(--accent);
    }

    .decision-select {
      min-width: 132px;
      border-radius: 999px;
      border: 1px solid rgba(34, 197, 94, 0.45);
      background: #ecfdf5;
      color: #166534;
      font-weight: 700;
      padding: 8px 14px;
      cursor: pointer;
    }

    .btn-upload.pending {
      background: rgba(245, 158, 11, 0.2);
      border-color: var(--warning);
      color: var(--warning);
    }

    .btn-upload.rejected {
      background: rgba(239, 68, 68, 0.2);
      border-color: var(--danger);
      color: var(--danger);
    }

    .btn-primary {
      margin-top: 20px;
      width: 100%;
      border-radius: 12px;
      padding: 14px 0;
      border: none;
      background: linear-gradient(135deg, var(--accent), var(--accent-dark));
      color: white;
      font-size: 0.95rem;
      cursor: pointer;
      font-weight: 600;
      box-shadow: 0 12px 25px rgba(34, 197, 94, 0.3);
      transition: var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .btn-primary:hover {
      filter: brightness(1.1);
      transform: translateY(-2px);
      box-shadow: 0 16px 30px rgba(34, 197, 94, 0.4);
    }

    .btn-primary:active {
      transform: translateY(0);
    }

    .btn-primary:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    .right-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .sla-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.85rem;
      padding: 16px;
      border-radius: 14px;
      background: radial-gradient(circle at top left, rgba(34, 197, 94, 0.2), transparent 60%),
                  var(--card-soft);
      border: 1px solid rgba(34, 197, 94, 0.5);
      transition: var(--transition);
    }

    .sla-box:hover {
      border-color: var(--accent);
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
    }

    .sla-time {
      font-size: 2rem;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      letter-spacing: 2px;
      color: var(--accent);
    }

    .sla-label {
      color: var(--text-soft);
      font-size: 0.75rem;
    }

    .sla-role {
      font-size: 0.8rem;
      text-align: right;
    }

    .sla-role strong {
      color: var(--accent);
      font-size: 1rem;
    }

    .kit-section {
      background: rgba(30, 41, 59, 0.5);
      border-radius: 12px;
      padding: 16px;
      margin-top: 12px;
      text-align: center;
    }

    .kit-section i {
      font-size: 2rem;
      color: var(--accent);
      margin-bottom: 12px;
      display: block;
    }

    .notification {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--card);
      border: 1px solid rgba(34, 197, 94, 0.5);
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 1000;
      transform: translateY(100px);
      opacity: 0;
      transition: var(--transition);
    }

    .notification.show {
      transform: translateY(0);
      opacity: 1;
    }

    .notification i {
      color: var(--accent);
      font-size: 1.2rem;
    }

    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      opacity: 0;
      visibility: hidden;
      transition: var(--transition);
    }

    .modal.active {
      opacity: 1;
      visibility: visible;
    }

    .modal-content {
      background: var(--card);
      border-radius: 16px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      border: 1px solid rgba(148, 163, 184, 0.2);
      box-shadow: var(--shadow);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .modal-header h3 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-soft);
      font-size: 1.2rem;
      cursor: pointer;
    }

    .progress-bar {
      height: 6px;
      background: rgba(148, 163, 184, 0.2);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 10px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--accent-dark));
      width: 0%;
      transition: width 0.5s ease;
    }

    .doc-thumbnail {
      height: 36px;
      width: 36px;
      object-fit: cover;
      border-radius: 6px;
      margin-left: 12px;
      border: 2px solid rgba(148, 163, 184, 0.2);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .doc-thumbnail:hover {
      transform: scale(1.8);
      border-color: var(--accent);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      z-index: 100;
    }

    /* Loading Overlay */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 3000;
      opacity: 0;
      visibility: hidden;
      transition: var(--transition);
    }

    .loading-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(34, 197, 94, 0.3);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  

    .checklist-only-card { max-width: 1120px; margin: 0 auto; }
    .topbar { display: none; }
    .checklist-backbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 14px;
    }
    .checklist-backbar a {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      border-radius: 14px;
      background: #0f172a;
      color: #f8fafc;
      text-decoration: none;
      font-weight: 900;
      box-shadow: 0 12px 26px rgba(15, 23, 42, .16);
      white-space: nowrap;
    }
    .kit-timeline-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kit-timeline-card {
      background: #ffffff;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 16px;
      padding: 20px 22px;
      box-shadow: var(--shadow);
    }
    .kit-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 18px;
    }
    .kit-header h2 {
      margin: 0;
      color: #0f172a;
      font-size: 1rem;
      letter-spacing: .1em;
      font-weight: 900;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .kit-status-badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(14, 165, 233, .26);
      background: rgba(14, 165, 233, .09);
      color: #075985;
      font-size: .72rem;
      font-weight: 900;
      white-space: nowrap;
    }
    .kit-agehab .kit-status-badge {
      border-color: rgba(245, 158, 11, .28);
      background: rgba(245, 158, 11, .12);
      color: #92400e;
    }
    .kit-stepper {
      position: relative;
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin-bottom: 14px;
      padding-top: 4px;
    }
    .kit-stepper::before {
      content: "";
      position: absolute;
      left: calc(8.33% + 10px);
      right: calc(8.33% + 10px);
      top: 14px;
      height: 3px;
      background: #dbe4ef;
      border-radius: 999px;
    }
    .kit-progress-fill {
      position: absolute;
      left: calc(8.33% + 10px);
      top: 14px;
      display: block;
      width: 0;
      max-width: calc(83.33% - 20px);
      height: 3px;
      border-radius: 999px;
      background: #22c55e;
      transition: width .25s ease;
    }
    .kit-step {
      position: relative;
      z-index: 1;
      min-width: 0;
      width: 100%;
      display: grid;
      justify-items: center;
      gap: 8px;
      color: #64748b;
      font-size: .68rem;
      font-weight: 800;
      text-align: center;
      line-height: 1.15;
    }
    .kit-dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ffffff;
      border: 2px solid #cbd5e1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: .58rem;
      font-weight: 900;
    }
    .kit-step.done {
      color: #0f172a;
    }
    .kit-step.done .kit-dot {
      border-color: #22c55e;
      background: #22c55e;
    }
    .kit-step.active {
      color: #0f172a;
      font-weight: 900;
    }
    .kit-step.active .kit-dot {
      border-color: transparent;
      box-shadow: 0 0 0 7px rgba(14, 165, 233, .14);
      background: #0ea5e9;
    }
    .kit-agehab .kit-step.active .kit-dot {
      box-shadow: 0 0 0 10px rgba(245, 158, 11, .16);
      background: #f59e0b;
    }
    .kit-step-label {
      display: block;
      width: 64px;
      max-width: calc(100% - 4px);
      font-size: 11px;
      line-height: 1.18;
      text-align: center;
      white-space: normal;
      overflow-wrap: break-word;
      word-break: keep-all;
    }
    .kit-stage-description {
      margin: 12px 0 0;
      color: #334155;
      font-size: .86rem;
      font-weight: 800;
      line-height: 1.4;
    }
    .dados-proponente-card {
      max-width: none;
    }
    .header-card {
      padding: 16px 20px;
      border-radius: 16px;
      background: #ffffff;
      border: 1px solid rgba(148, 163, 184, 0.28);
      box-shadow: 0 12px 26px rgba(15, 23, 42, 0.07);
    }
    .dados-proponente-card > h2,
    .dados-proponente-card > small {
      display: none;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      margin-bottom: 12px;
    }
    .header-title {
      margin: 0;
      font-size: 24px;
      line-height: 1.1;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: none;
      color: #0f172a;
    }
    .header-subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #475569;
      line-height: 1.35;
      font-weight: 700;
    }
    .header-badge {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #475569;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .dados-proponente-card .section {
      margin-top: 0;
      padding-top: 0;
      border-top: 0;
    }
    .dados-proponente-card .section:first-of-type {
      border-top: 0;
    }
    .dados-proponente-card .section-title {
      display: none;
    }
    .executive-title-input,
    .executive-meta-field input {
      width: 100%;
      height: auto;
      min-height: 0;
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
      border-radius: 0;
      pointer-events: none;
    }
    .executive-title-input {
      color: #0f172a;
      font-size: 30px;
      line-height: 1.12;
      font-weight: 900;
      letter-spacing: -0.01em;
    }
    .executive-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      color: #475569;
      font-size: 13px;
      font-weight: 700;
    }
    .executive-meta-field {
      display: inline-flex;
      align-items: center;
      min-width: 0;
    }
    .executive-meta-field input {
      display: inline-block;
      width: auto;
      max-width: 190px;
      color: #475569;
      font: inherit;
      opacity: .92;
    }
    .executive-meta-separator {
      color: #94a3b8;
    }
    .status-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 10px 0 12px;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      font-size: 11px;
      font-weight: 900;
      white-space: nowrap;
    }
    .status-chip::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
    }
    .status-chip[data-status-kind="caixa"]::before {
      background: #0ea5e9;
    }
    .status-chip[data-status-kind="agehab"]::before {
      background: #f59e0b;
    }
    .status-chip input {
      display: inline;
      width: auto;
      max-width: 110px;
      height: auto;
      min-height: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      pointer-events: none;
      box-shadow: none;
      border-radius: 0;
    }
    .editable-grid,
    .dados-proponente-card .form-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px 12px;
    }
    .dados-proponente-card label {
      display: block;
      margin-bottom: 4px;
      color: #334155;
      font-size: 10px;
      line-height: 1.2;
      font-weight: 900;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .dados-proponente-card input,
    .dados-proponente-card select {
      width: 100%;
      height: 44px;
      min-height: 0;
      padding: 0 12px;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      box-sizing: border-box;
    }
    .dados-proponente-card .executive-title-input {
      height: auto;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: #0f172a;
      font-size: 30px;
      line-height: 1.12;
      font-weight: 900;
      letter-spacing: -0.01em;
      box-shadow: none;
    }
    .dados-proponente-card .executive-meta-field input,
    .dados-proponente-card .status-chip input {
      width: auto;
      height: auto;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      box-shadow: none;
      pointer-events: none;
    }
    .dados-proponente-card .hint {
      display: none;
    }
    .dados-proponente-card > .section:nth-of-type(2),
    .dados-proponente-card .dados-actions {
      display: none;
    }
    .header-actions {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
    }
    .header-actions .btn-primary {
      min-width: 0;
      width: 100%;
      min-height: 44px;
    }
    .header-actions #btnAcompanhar {
      background: #ffffff;
      color: #0f172a;
      border: 1px solid var(--border);
      box-shadow: none;
    }
    .header-actions #btnProcessChat {
      background: #ffffff;
      color: #0f172a;
      border: 1px solid var(--border);
      box-shadow: none;
    }
    @media (max-width: 1100px) {
      .editable-grid,
      .dados-proponente-card .form-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 700px) {
      .kit-timeline-grid { grid-template-columns: 1fr; }
      .kit-header { flex-direction: column; gap: 10px; }
      .kit-stepper { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 18px; }
      .kit-stepper::before,
      .kit-progress-fill { display: none; }
      .header-top { flex-direction: column; }
      .editable-grid,
      .header-actions,
      .dados-proponente-card .form-grid { grid-template-columns: 1fr; }
      .header-card { padding: 14px; border-radius: 14px; }
    }
    .file-row-desc { white-space: pre-line; }
    .pendency-note {
      margin-top: 10px;
      padding: 10px 12px;
      border-left: 4px solid #ef4444;
      border-radius: 10px;
      background: #fff1f2;
      color: #991b1b;
      font-size: .82rem;
      font-weight: 800;
      line-height: 1.35;
      white-space: pre-line;
      max-height: 96px;
      overflow-y: auto;
    }
    .pendency-note small {
      display: block;
      margin-top: 4px;
      color: #7f1d1d;
      font-weight: 700;
    }
    .analyst-review {
      margin-top: 12px;
      max-width: 780px;
    }
    .review-fields {
      display: grid;
      grid-template-columns: minmax(160px, 220px) minmax(240px, 1fr) minmax(170px, 210px);
      gap: 10px 12px;
      align-items: end;
    }
    .review-fields [data-pendency-box] {
      display: contents;
    }
    .document-body [data-pendency-box] {
      display: contents;
    }
    .review-fields [data-pendency-box][hidden] {
      display: none;
    }
    .document-body [data-pendency-box][hidden] {
      display: none;
    }
    .analyst-review select,
    .analyst-review input,
    .analyst-review textarea {
      width: 100%;
      border: 1px solid rgba(15, 23, 42, .14);
      border-radius: 12px;
      background: #fff;
      color: #0f172a;
      padding: 8px 10px;
      font: inherit;
      font-size: .82rem;
      box-sizing: border-box;
    }
    .review-field {
      min-width: 0;
    }
    .review-field label {
      display: block;
      margin-bottom: 5px;
      color: #475569;
      font-size: 10px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    .analyst-review textarea {
      min-height: 78px;
      resize: vertical;
      overflow: hidden;
    }
    .review-field-observation {
      grid-column: span 2;
    }
    .review-actions {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 2px;
    }
    .analyst-review button {
      width: auto;
      box-sizing: border-box;
      min-height: 34px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: #16a34a;
      color: #fff;
      font-weight: 900;
      cursor: pointer;
      white-space: nowrap;
    }
    .document-actions > button {
      width: auto;
      box-sizing: border-box;
      min-height: 34px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: #16a34a;
      color: #fff;
      font-weight: 900;
      cursor: pointer;
      white-space: nowrap;
    }
    .file-upload-action { min-width: 145px; }
    .document-card {
      padding: 18px 24px;
      border-radius: 18px;
      border: 1px solid #dbe3ef;
      border-left: 5px solid #ef4444;
      background: #fff;
    }
    .document-inner {
      max-width: 1180px;
      margin: 0 auto;
    }
    .document-card[data-status="pendenciado"] { border-left-color: #ef4444; }
    .document-card[data-status="enviado"] { border-left-color: #0ea5e9; }
    .document-card[data-status="aprovado"] { border-left-color: #22c55e; }
    .document-card[data-status="em-analise"] { border-left-color: #f59e0b; }
    .document-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 18px;
    }
    .document-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 800;
    }
    .document-desc {
      margin-top: 6px;
      color: #475569;
      line-height: 1.4;
    }
    .document-status-badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      font-size: 11px;
      font-weight: 900;
      white-space: nowrap;
    }
    .document-table-mode .section {
      padding: 14px;
      overflow: visible;
    }
    .document-table-mode .section-title {
      margin-bottom: 4px;
    }
    .document-table-mode .section-summary {
      margin-bottom: 10px;
    }
    .document-table-wrap {
      width: 100%;
      overflow-x: auto;
      overflow-y: visible;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
    }
    .document-table-header,
    .document-table-mode .file-header {
      min-width: 1040px;
      display: grid;
      grid-template-columns: minmax(190px, 1.35fr) minmax(280px, 1.75fr) 105px 120px 155px 165px minmax(292px, 292px);
      align-items: center;
      gap: 0;
    }
    .document-table-header {
      position: sticky;
      top: 0;
      z-index: 3;
      background: #f8fafc;
      border-bottom: 1px solid #dbe3ee;
      color: #475569;
      font-size: .68rem;
      font-weight: 800;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .document-table-header > span,
    .document-table-cell {
      min-height: 42px;
      padding: 9px 10px;
      border-right: 1px solid #edf2f7;
      display: flex;
      align-items: center;
      min-width: 0;
    }
    .document-table-header > span:last-child,
    .document-table-cell:last-child {
      border-right: 0;
    }
    .document-table-mode .file-row {
      display: block;
      padding: 0;
      margin: 0;
      border: 0;
      border-radius: 0;
      border-left: 0;
      background: #fff;
      border-bottom: 1px solid #eef2f7;
    }
    .document-table-mode .file-row:hover {
      background: #f8fafc;
    }
    .document-table-mode .file-row:last-child {
      border-bottom: 0;
    }
    .document-table-mode .file-info {
      display: flex;
      align-items: center;
    }
    .document-table-mode .file-row-title {
      font-size: .78rem;
      line-height: 1.25;
      font-weight: 800;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .document-table-mode .file-row-title i {
      display: none;
    }
    .document-table-mode .file-row-desc {
      margin: 0;
      font-size: .72rem;
      line-height: 1.3;
      color: #475569;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: normal;
    }
    .document-table-mode .file-row-desc.is-expanded {
      display: block;
      overflow: visible;
    }
    .doc-description-cell {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
    .doc-description-toggle {
      border: 0;
      background: transparent;
      color: #2563eb;
      font-size: .7rem;
      font-weight: 700;
      padding: 0;
      cursor: pointer;
    }
    .doc-muted {
      color: #64748b;
      font-size: .74rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .doc-status-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      min-width: fit-content;
      padding: 10px 14px;
      font-size: .64rem;
      font-weight: 900;
      line-height: 1;
      box-sizing: border-box;
      letter-spacing: .03em;
      text-transform: uppercase;
      white-space: nowrap;
      border: 1px solid #cbd5e1;
      color: #475569;
      background: #f8fafc;
    }
    .doc-status-pill.status-em-analise,
    .doc-status-pill.status-enviado {
      background: #fff7ed;
      border-color: #fed7aa;
      color: #9a3412;
    }
    .doc-status-pill.status-pendente,
    .doc-status-pill.status-pendenciado {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }
    .doc-status-pill.status-aprovado {
      background: #ecfdf5;
      border-color: #bbf7d0;
      color: #166534;
    }
    .doc-status-pill.status-reprovado {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #0f172a;
    }
    .doc-deadline-cell {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
    .doc-deadline-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      padding: 4px 8px;
      font-size: .64rem;
      font-weight: 900;
      white-space: nowrap;
      background: #f8fafc;
      color: #475569;
    }
    .doc-deadline-badge.deadline-ok {
      background: #ecfdf5;
      border-color: #bbf7d0;
      color: #166534;
    }
    .doc-deadline-badge.deadline-near {
      background: #fefce8;
      border-color: #fde68a;
      color: #854d0e;
    }
    .doc-deadline-badge.deadline-late {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }
    .doc-options-cell {
      justify-content: flex-start;
      gap: 8px;
      overflow: visible;
      min-width: 292px;
      flex-wrap: nowrap;
    }
    .doc-action-menu {
      position: relative;
    }
    .doc-action-trigger,
    .document-table-mode .btn-upload {
      min-width: fit-content;
      min-height: 38px;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: .72rem;
      font-weight: 800;
      line-height: 1;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #0f172a;
      box-shadow: none;
      white-space: nowrap;
      overflow: visible;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .doc-action-trigger {
      min-width: 92px;
      cursor: pointer;
    }
    .document-table-mode .btn-upload {
      min-width: 150px;
    }
    .doc-action-trigger i,
    .document-table-mode .btn-upload i,
    .doc-status-pill i {
      flex-shrink: 0;
    }
    .doc-action-dropdown {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      min-width: 190px;
      padding: 6px;
      border: 1px solid #dbe3ee;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 18px 35px rgba(15, 23, 42, .16);
      z-index: 50;
      display: none;
    }
    .doc-action-menu.is-open .doc-action-dropdown {
      display: block;
    }
    .doc-action-dropdown button {
      width: 100%;
      border: 0;
      background: transparent;
      border-radius: 6px;
      padding: 8px 9px;
      text-align: left;
      font-size: .75rem;
      color: #334155;
      cursor: pointer;
    }
    .doc-action-dropdown button:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .document-table-mode .analyst-review {
      margin: 0;
      border: 0;
      border-top: 1px solid #e2e8f0;
      border-radius: 0;
      background: #fbfdff;
      padding: 12px;
      max-width: none;
    }
    .document-table-mode .analyst-review[hidden] {
      display: none;
    }
    .relationship-table .document-table-header,
    .relationship-table .file-header {
      min-width: 820px;
      grid-template-columns: minmax(230px, 1.5fr) minmax(260px, 1.5fr) 110px 150px 170px;
    }
    .relationship-table .file-row-title {
      font-weight: 900;
    }
    .relationship-table .file-row-desc {
      font-size: .7rem;
      -webkit-line-clamp: 3;
    }
    .relationship-response-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: fit-content;
      border-radius: 999px;
      border: 1px solid #fde68a;
      background: #fefce8;
      color: #854d0e;
      padding: 10px 14px;
      font-size: .64rem;
      font-weight: 900;
      line-height: 1;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .relationship-response-pill.response-sim {
      border-color: #bbf7d0;
      background: #ecfdf5;
      color: #166534;
    }
    .relationship-response-pill.response-nao {
      border-color: #fecaca;
      background: #fef2f2;
      color: #991b1b;
    }
    .relationship-response-pill.response-na {
      border-color: #cbd5e1;
      background: #f8fafc;
      color: #475569;
    }
    .relationship-actions-cell {
      gap: 8px;
      overflow: visible;
    }
    .relationship-answer-menu {
      position: relative;
    }
    .relationship-answer-trigger,
    .relationship-answer-dropdown button {
      min-width: 112px;
      min-height: 38px;
      border-radius: 6px;
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #0f172a;
      font-size: .72rem;
      font-weight: 800;
      line-height: 1;
      box-sizing: border-box;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
    }
    .relationship-answer-dropdown {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      display: none;
      min-width: 132px;
      padding: 6px;
      border: 1px solid #dbe3ee;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 18px 35px rgba(15, 23, 42, .16);
      z-index: 50;
    }
    .relationship-answer-menu.is-open .relationship-answer-dropdown {
      display: grid;
      gap: 4px;
    }
    .relationship-native-select {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .document-body {
      display: grid;
      grid-template-columns: 320px 520px;
      gap: 24px;
      align-items: start;
    }
    .document-left,
    .document-right {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }
    .document-field label {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: .05em;
    }
    .document-field select,
    .document-field textarea,
    .document-field input {
      width: 100%;
      min-height: 48px;
      box-sizing: border-box;
    }
    .document-field textarea {
      min-height: 110px;
      resize: vertical;
    }
    .document-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin-top: 0;
    }
    .upload-action {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .upload-action .dot {
      order: -1;
    }
    .doc-chat-count {
      margin-left: 6px;
      color: #0f172a;
    }
    .doc-chat-panel {
      max-width: 1180px;
      margin: 12px auto 0;
      border: 1px solid #dbe3ef;
      border-radius: 14px;
      background: #f8fafc;
      padding: 12px;
    }
    .doc-chat-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 260px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .doc-chat-empty {
      color: #64748b;
      font-size: .82rem;
      font-weight: 800;
    }
    .doc-chat-message {
      max-width: 72%;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      padding: 8px 10px;
      color: #0f172a;
      font-size: .82rem;
      line-height: 1.35;
    }
    .doc-chat-message.mine {
      align-self: flex-end;
      background: #ecfdf5;
      border-color: #bbf7d0;
    }
    .doc-chat-meta {
      display: block;
      margin-bottom: 4px;
      color: #64748b;
      font-size: .68rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .doc-chat-compose {
      display: grid;
      grid-template-columns: 180px minmax(0, 1fr) auto;
      gap: 10px;
      margin-top: 10px;
      align-items: end;
    }
    .doc-chat-compose select,
    .doc-chat-compose textarea {
      width: 100%;
      box-sizing: border-box;
      color: #0f172a;
      background: #fff;
      font: inherit;
      font-size: .82rem;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
    }
    .doc-chat-compose select {
      min-height: 46px;
      padding: 0 11px;
      font-weight: 900;
    }
    .doc-chat-compose textarea {
      min-height: 46px;
      max-height: 120px;
      resize: vertical;
      padding: 9px 11px;
    }
    .doc-chat-compose button {
      min-height: 42px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: #0f172a;
      color: #fff;
      font-weight: 900;
      cursor: pointer;
    }
    .document-actions .analyst-review button {
      width: auto;
    }
    .section-summary { color: var(--text-soft); font-size: .78rem; }
    .doc-counter { color: var(--accent); font-weight: 700; }
    .btn-upload input[type="file"] { display: none; }
    @media (max-width: 1000px) {
      .document-body {
        grid-template-columns: 1fr;
      }

      .document-actions {
        justify-content: stretch;
      }

      .document-actions button,
      .document-actions label {
        flex: 1;
      }
      .doc-chat-compose { grid-template-columns: 1fr; }
      .doc-chat-message { max-width: 100%; }
    }
    @media (max-width: 700px) {
      .file-header { grid-template-columns: 1fr; }
      .file-upload-action { width: 100%; justify-content: flex-start; }
      .analyst-review { max-width: 100%; }
      .review-fields { grid-template-columns: 1fr; }
      .review-field-observation { grid-column: auto; }
      .review-actions { justify-content: flex-start; flex-wrap: wrap; }
      .btn-upload { flex: 1; justify-content: center; }
    }`,s=[{key:"reserva",label:"Recebido"},{key:"em_analise_credito",label:"Confer\xeancia"},{key:"emitindo_formularios",label:"Emitir Formul\xe1rios"},{key:"formularios_em_assinatura",label:"Formul\xe1rios Anexos"},{key:"formularios_assinados",label:"Formul\xe1rios Assinados"},{key:"envio_conformidade",label:"Envio Conformidade"}],r=[{key:"reserva",label:"Recebido"},{key:"em_analise_credito",label:"An\xe1lise"},{key:"ficha_emitida",label:"Crit\xe9rios"},{key:"ficha_recebida",label:"Ficha"},{key:"em_validacao_agehab",label:"Envio"},{key:"agehab_validada",label:"Finalizado"}],c=({tone:e,title:a,steps:o,currentStep:t,description:i})=>{let n=Math.max(0,o.findIndex(e=>e.key===t)),d=o[n]?.label||o[0]?.label||"Recebido",s=o.length>1?n/(o.length-1)*100:0;return String.raw`<div class="kit-timeline-card kit-${e}" data-timeline="${e}" data-current-stage="${t}">
        <div class="kit-header">
          <h2>${a}</h2>
          <span class="kit-status-badge" data-stage-badge="${e}">${d}</span>
        </div>
        <div class="kit-stepper" role="list" aria-label="${a}">
          <span class="kit-progress-fill" data-stage-progress="${e}" style="width:${s}%"></span>
          ${o.map((e,a)=>{let o=a<n?"done":a===n?"active":"pending",t="done"===o?"✓":String(a+1);return String.raw`<div class="kit-step ${o}" data-stage="${e.key}" data-state="${o}" role="listitem">
            <span class="kit-dot" aria-hidden="true">${t}</span>
            <span class="kit-step-label">${e.label}</span>
          </div>`}).join("")}
        </div>
        <p class="kit-stage-description" data-stage-description="${e}">${i}</p>
      </div>`},l=String.raw`<div class="app-container">
    <div class="topbar">
      <div class="topbar-left">
        <h1><i class="fas fa-file-contract"></i> Checklist de Documentos</h1>
        <div class="badge">UPLOAD DE DOCUMENTOS</div>
        <div class="subtitle">Checklist extraído do painel do analista com layout, cores, luz indicadora e botão de upload do DOCTYPE HTML.</div>
      </div>
      <div class="topbar-right">
        <div><strong>Total de documentos:</strong> 36</div>
        <div><strong>Status:</strong> <span id="totalEnviados">0</span> enviados</div>
        <div class="user-line">Cada documento mantém o semáforo visual individual.</div>
        <a class="btn-voltar-acompanhamento" href="/corretor">Voltar para acompanhamento</a>
      </div>
    </div>


    <div class="checklist-backbar">
      <a href="/corretor">Voltar</a>
    </div>


    <div class="kit-timeline-grid">
      ${c({tone:"caixa",title:"KIT CAIXA",steps:s,currentStep:"reserva",description:"Cliente em reserva. Aguardando inicio da analise de credito."})}
      ${c({tone:"agehab",title:"KIT AGEHAB",steps:r,currentStep:"reserva",description:"Cliente em reserva. Aguardando inicio da analise de credito."})}
    </div>


    <div class="card dados-proponente-card header-card">
      <h2><i class="fas fa-user-circle"></i> Dados do Proponente & Dependentes</h2>
      <small>Preencha os dados básicos. Informações sensíveis (CPF, telefone, etc.) continuam apenas no CRM.</small>

      <div class="section">
        <div class="header-top">
          <div>
            <h2 class="header-title">Proponente</h2>
            <p class="header-subtitle">Identificação e dados comerciais do processo</p>
          </div>
          <span class="header-badge">Identificação do processo</span>
        </div>

        <div class="header-top">
          <div>
            <input class="executive-title-input" type="text" id="nomeCompleto" placeholder="Nome do proponente" />
            <div class="executive-meta">
              <span>Reserva #</span><span class="executive-meta-field"><input type="text" id="numeroReserva" placeholder="458712" readonly /></span>
              <span class="executive-meta-separator">-</span>
              <span>Produto</span><span class="executive-meta-field"><input type="text" id="produto" value="PP" readonly /></span>
              <span class="executive-meta-separator">-</span>
              <span>Corretor</span><span class="executive-meta-field"><input type="text" id="corretor" placeholder="Nome do corretor" /></span>
            </div>
          </div>
        </div>

        <div class="status-strip" aria-label="Status operacional">
          <span class="status-chip" data-status-kind="sinal">Sinal <input type="text" id="sinalOk" value="Nao tem" readonly /></span>
          <span class="status-chip" data-status-kind="fiador">Fiador <input type="text" id="fiadorOk" value="Nao tem" readonly /></span>
          <span class="status-chip" data-status-kind="caixa">Caixa <select id="caixaStatus"><option value="reserva">Recebido</option><option value="em_analise_credito">Conferência</option><option value="emitindo_formularios">Emitir Formulários</option><option value="formularios_em_assinatura">Formulários Anexos</option><option value="formularios_assinados">Formulários Assinados</option></select></span>
          <span class="status-chip" data-status-kind="agehab">Agehab <select id="agehabStatus"><option value="reserva">Recebido</option><option value="em_analise_credito">Análise</option><option value="ficha_emitida">Critérios</option><option value="ficha_recebida">Ficha</option><option value="em_validacao_agehab">Envio</option><option value="agehab_validada">Finalizado</option></select></span>
          <span class="status-chip" data-status-kind="caixa" data-cca-conformidade-chip hidden>Conformidade <input type="checkbox" id="ccaEnviadoConformidade" /> Enviado</span>
        </div>

        <div class="form-grid editable-grid">
          <div class="form-group">
            <label>Cidade</label>
            <input type="text" id="cidade" placeholder="Ex: Águas Lindas de Goiás" />
          </div>

          <div class="form-group">
            <label>Empreendimento</label>
            <select id="empreendimento">
              <option value="">Selecione...</option>
              <option>AGL</option>
              <option>FSA</option>
              <option>Catalão</option>
              <option>Outro</option>
            </select>
          </div>

          <div class="form-group">
            <label>Estado civil</label>
            <select id="estadoCivil">
              <option value="">Selecione...</option>
              <option value="solteiro">Solteiro(a)</option>
              <option value="casado">Casado(a)</option>
              <option value="uniao_estavel">União estável</option>
              <option value="divorciado">Divorciado(a)</option>
              <option value="viuvo">Viúvo(a)</option>
            </select>
            <div class="hint">
              <i class="fas fa-info-circle"></i> Se marcar <strong>casado</strong> ou <strong>união estável</strong>, serão exigidos docs do cônjuge.
            </div>
          </div>

          <div class="form-group">
            <label>Tipo de renda</label>
            <select id="tipoRenda">
              <option value="">Selecione...</option>
              <option value="formal">Formal (CLT / comprovada)</option>
              <option value="informal">Informal</option>
              <option value="mista">Mista (formal + informal)</option>
            </select>
            <div class="hint">
              <i class="fas fa-exclamation-triangle"></i>
              <strong>Formal:</strong> obrigatório enviar <strong>extrato de FGTS</strong>.<br>
              <strong>Informal:</strong> obrigatório anexar <strong>Declaração de Não Renda para Agehab.</strong>
            </div>
          </div>

          <div class="form-group">
            <label>Tipo de dependente</label>
            <select id="tipoDependente">
              <option value="">Nao definido</option>
              <option value="filho_menor">Filho menor</option>
              <option value="filho_maior">Filho maior</option>
              <option value="parente">Parente ate 3 grau</option>
            </select>
          </div>

          <div class="form-group" id="dependenteCasadoGroup">
            <label>Dependente casado?</label>
            <select id="dependenteCasado">
              <option value="nao" selected>Nao</option>
              <option value="sim">Sim</option>
            </select>
          </div>
        </div>      </div>

      <div class="section">
        <div class="section-title">
          <span>Dependentes</span>
          <span class="pill">Regras automáticas por tipo</span>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Tipo de dependente</label>
            <select id="tipoDependente">
              <option value="">Selecione...</option>
              <option value="filho_menor">Filho menor</option>
              <option value="filho_maior">Filho maior</option>
              <option value="parente">Parente até 3º grau</option>
            </select>
          </div>

          <div class="form-group" id="dependenteCasadoGroup">
            <label>Dependente casado?</label>
            <select id="dependenteCasado">
              <option value="nao" selected>Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>
        </div>

      </div>

      <div class="header-actions">
        <button class="btn-primary" id="btnSalvar">
          <i class="fas fa-save"></i> Salvar
        </button>
        <button class="btn-primary" id="btnAcompanhar">
          <i class="fas fa-list"></i> Acompanhamento
        </button>
        <button class="btn-primary" id="btnProcessChat">
          <i class="fas fa-comments"></i> Chat CCA <span class="doc-chat-count"></span>
        </button>
      </div>
    </div>

    <div class="card checklist-only-card">
      <h2><i class="fas fa-list-check"></i> Conferência e envio do checklist</h2>
      <small>Somente tipo de documento, descrição, indicador visual e botão de upload. Sem os campos extras do painel do analista.</small>
      <div data-kit-caixa-download-slot></div>

          <div class="section">
            <div class="section-title">
              <span>Documentos do Proponente</span>
              <span class="pill"><span class="doc-counter">6</span> documentos</span>
            </div>
            <div class="section-summary">Base do dossiê do proponente (identidade, estado civil, residência, etc.).</div>


            <div class="file-row document-card" data-doc="documentos-do-proponente-identidade-e-cpf-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-id-card"></i> Identidade e CPF</span>
                <span class="file-row-desc document-desc">CNH, RG, Identidade Militar, Passaporte brasileiro ou carteira funcional com fé pública (dentro da validade) do proponente.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-do-proponente-identidade-e-cpf-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-do-proponente-identidade-e-cpf-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-do-proponente-identidade-e-cpf-1" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-do-proponente-comp-de-estado-civil-2" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-heart"></i> Comp. de estado civil</span>
                <span class="file-row-desc document-desc">Certidão de nascimento.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-do-proponente-comp-de-estado-civil-2" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-do-proponente-comp-de-estado-civil-2">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-do-proponente-comp-de-estado-civil-2" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-do-proponente-comprovante-de-residencia-3" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-house"></i> Comprovante de residência</span>
                <span class="file-row-desc document-desc">Comprovante aberto; não precisa estar no nome do cliente.
Água, luz, telefone, internet, celular, cartão de crédito.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-do-proponente-comprovante-de-residencia-3" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-do-proponente-comprovante-de-residencia-3">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-do-proponente-comprovante-de-residencia-3" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-do-proponente-irpf-recibo-4" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> IRPF + recibo</span>
                <span class="file-row-desc document-desc">Declaração completa do ano atual + recibo de entrega + DARF pago (se houver).
⚠️ Somente se perfil = INFORMAL e IRPF para informal = SIM.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-do-proponente-irpf-recibo-4" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-do-proponente-irpf-recibo-4">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-do-proponente-irpf-recibo-4" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-do-proponente-extrato-fgts-5" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-money-bill-wave"></i> Extrato FGTS</span>
                <span class="file-row-desc document-desc">App FGTS / site Caixa / agência.
Militar/soldado: anexar também 3 últimos extratos bancários da conta salário.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-do-proponente-extrato-fgts-5" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-do-proponente-extrato-fgts-5">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-do-proponente-extrato-fgts-5" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-do-proponente-ctps-carteira-6" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> CTPS (carteira)</span>
                <span class="file-row-desc document-desc">Carteira Digital (todas infos) ou CTPS física: qualificação, contratos e anotações.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-do-proponente-ctps-carteira-6" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-do-proponente-ctps-carteira-6">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-do-proponente-ctps-carteira-6" />
                </label>
              </div>
              </div>
            </div>

          </div>

          <div class="section">
            <div class="section-title">
              <span>Dependente — Filhos menores de 18 anos</span>
              <span class="pill"><span class="doc-counter">1</span> documentos</span>
            </div>
            <div class="section-summary">Aparece quando o tipo de dependente for &quot;Filho menor&quot;.</div>


            <div class="file-row document-card" data-doc="dependente-filhos-menores-de-18-anos-certidao-de-nascimento-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-heart"></i> Certidão de nascimento</span>
                <span class="file-row-desc document-desc">Guarda/adoção: anexar termos respectivos.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-dependente-filhos-menores-de-18-anos-certidao-de-nascimento-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-dependente-filhos-menores-de-18-anos-certidao-de-nascimento-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="dependente-filhos-menores-de-18-anos-certidao-de-nascimento-1" />
                </label>
              </div>
              </div>
            </div>

          </div>

          <div class="section">
            <div class="section-title">
              <span>Dependente — Filhos maiores / parentes até 3º grau</span>
              <span class="pill"><span class="doc-counter">3</span> documentos</span>
            </div>
            <div class="section-summary">Aparece quando o dependente não for &quot;Filho menor&quot;.</div>


            <div class="file-row document-card" data-doc="dependente-filhos-maiores-parentes-ate-3-grau-identidade-e-cpf-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-id-card"></i> Identidade e CPF</span>
                <span class="file-row-desc document-desc">CNH, RG, Identidade Militar, Passaporte brasileiro ou carteira funcional com fé pública (dentro da validade) do dependente.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-dependente-filhos-maiores-parentes-ate-3-grau-identidade-e-cpf-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-dependente-filhos-maiores-parentes-ate-3-grau-identidade-e-cpf-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="dependente-filhos-maiores-parentes-ate-3-grau-identidade-e-cpf-1" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="dependente-filhos-maiores-parentes-ate-3-grau-comp-de-estado-civil-2" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-heart"></i> Comp. de estado civil</span>
                <span class="file-row-desc document-desc">SOLTEIRO: Certidão de nascimento
CASADO: Certidão de casamento – RG/CPF do cônjuge se houver renda
VIÚVO: Certidão de casamento e óbito
DIVORCIADO: Certidão averbada.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-dependente-filhos-maiores-parentes-ate-3-grau-comp-de-estado-civil-2" title="Não enviado"></span>
                <label class="btn-upload" id="btn-dependente-filhos-maiores-parentes-ate-3-grau-comp-de-estado-civil-2">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="dependente-filhos-maiores-parentes-ate-3-grau-comp-de-estado-civil-2" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="dependente-filhos-maiores-parentes-ate-3-grau-declaracao-de-parentesco-3" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> Declaração de parentesco</span>
                <span class="file-row-desc document-desc">Declaração conforme regras Caixa, vinculando dependente ao proponente.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-dependente-filhos-maiores-parentes-ate-3-grau-declaracao-de-parentesco-3" title="Não enviado"></span>
                <label class="btn-upload" id="btn-dependente-filhos-maiores-parentes-ate-3-grau-declaracao-de-parentesco-3">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="dependente-filhos-maiores-parentes-ate-3-grau-declaracao-de-parentesco-3" />
                </label>
              </div>
              </div>
            </div>

          </div>

          <div class="section">
            <div class="section-title">
              <span>Renda formal (CLT / vínculo)</span>
              <span class="pill"><span class="doc-counter">2</span> documentos</span>
            </div>
            <div class="section-summary">Aparece quando perfil de renda = CLT.</div>


            <div class="file-row document-card" data-doc="renda-formal-clt-vinculo-holerites-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-money-bill-wave"></i> Holerites</span>
                <span class="file-row-desc document-desc">3 últimos holerites/contracheques (nome/CNPJ/cargo/admissão/bruto).</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-renda-formal-clt-vinculo-holerites-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-renda-formal-clt-vinculo-holerites-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="renda-formal-clt-vinculo-holerites-1" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="renda-formal-clt-vinculo-renda-variavel-2" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-money-bill-wave"></i> Renda variável</span>
                <span class="file-row-desc document-desc">Comissões/HE/adicional: holerites suficientes para média conforme Caixa.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-renda-formal-clt-vinculo-renda-variavel-2" title="Não enviado"></span>
                <label class="btn-upload" id="btn-renda-formal-clt-vinculo-renda-variavel-2">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="renda-formal-clt-vinculo-renda-variavel-2" />
                </label>
              </div>
              </div>
            </div>

          </div>

          <div class="section">
            <div class="section-title">
              <span>Renda informal (autônomo / liberal)</span>
              <span class="pill"><span class="doc-counter">1</span> documentos</span>
            </div>
            <div class="section-summary">Aparece quando perfil de renda = INFORMAL.</div>


            <div class="file-row document-card" data-doc="renda-informal-autonomo-liberal-extrato-bancario-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-money-bill-wave"></i> Extrato bancário</span>
                <span class="file-row-desc document-desc">3 últimos meses (preferir mês fechado). Aceita PDF/impresso e bancos digitais.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-renda-informal-autonomo-liberal-extrato-bancario-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-renda-informal-autonomo-liberal-extrato-bancario-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="renda-informal-autonomo-liberal-extrato-bancario-1" />
                </label>
              </div>
              </div>
            </div>

          </div>

          <div class="section">
            <div class="section-title">
              <span>Aposentados / Pensionistas</span>
              <span class="pill"><span class="doc-counter">1</span> documentos</span>
            </div>
            <div class="section-summary">Aparece quando perfil de renda = APOSENTADO.</div>


            <div class="file-row document-card" data-doc="aposentados-pensionistas-extrato-do-beneficio-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-money-bill-wave"></i> Extrato do benefício</span>
                <span class="file-row-desc document-desc">Último extrato (Meu INSS / Dataprev).</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-aposentados-pensionistas-extrato-do-beneficio-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-aposentados-pensionistas-extrato-do-beneficio-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="aposentados-pensionistas-extrato-do-beneficio-1" />
                </label>
              </div>
              </div>
            </div>

          </div>

          <div class="section">
            <div class="section-title">
              <span>Domésticos / contratação por CPF</span>
              <span class="pill"><span class="doc-counter">1</span> documentos</span>
            </div>
            <div class="section-summary">Aparece quando perfil de renda = DOMÉSTICO.</div>


            <div class="file-row document-card" data-doc="domesticos-contratacao-por-cpf-esocial-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> eSocial</span>
                <span class="file-row-desc document-desc">3 últimos comprovantes do eSocial.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-domesticos-contratacao-por-cpf-esocial-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-domesticos-contratacao-por-cpf-esocial-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="domesticos-contratacao-por-cpf-esocial-1" />
                </label>
              </div>
              </div>
            </div>

          </div>

          <div class="section">
            <div class="section-title">
              <span>Documentos Caixa</span>
              <span class="pill"><span class="doc-counter">7</span> documentos</span>
            </div>
            <div class="section-summary">Extras (Cheque Azul/Cartão) aparecem se &quot;CCA gerou formulários&quot; = SIM.</div>


            <div class="file-row document-card" data-doc="documentos-caixa-damp-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> DAMP</span>
                <span class="file-row-desc document-desc">Preenchida e assinada digitalmente. Físico só com aprovação do crédito.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-caixa-damp-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-caixa-damp-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-caixa-damp-1" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-caixa-ficha-de-cadastro-caixa-2" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-building-columns"></i> Ficha de cadastro Caixa</span>
                <span class="file-row-desc document-desc">Preenchida (endereço igual ao cadastro). Assinada digitalmente; físico com aprovação.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-caixa-ficha-de-cadastro-caixa-2" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-caixa-ficha-de-cadastro-caixa-2">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-caixa-ficha-de-cadastro-caixa-2" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-caixa-abertura-de-conta-3" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-building-columns"></i> Abertura de conta</span>
                <span class="file-row-desc document-desc">Assinada digitalmente; físico precisa aprovação do crédito.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-caixa-abertura-de-conta-3" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-caixa-abertura-de-conta-3">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-caixa-abertura-de-conta-3" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-caixa-mo-4" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> MO</span>
                <span class="file-row-desc document-desc">Assinatura correta (2ª página). Casal: assinatura de ambos.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-caixa-mo-4" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-caixa-mo-4">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-caixa-mo-4" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-caixa-formulario-cheque-azul-5" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> Formulário Cheque Azul</span>
                <span class="file-row-desc document-desc">Formulário de contratação (assinatura digital). Físico somente com aprovação.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-caixa-formulario-cheque-azul-5" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-caixa-formulario-cheque-azul-5">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-caixa-formulario-cheque-azul-5" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-caixa-formulario-cartao-6" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> Formulário Cartão</span>
                <span class="file-row-desc document-desc">Formulário do cartão Caixa com campos obrigatórios e assinatura digital.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-caixa-formulario-cartao-6" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-caixa-formulario-cartao-6">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-caixa-formulario-cartao-6" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-caixa-proposta-cartao-7" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> Proposta Cartão</span>
                <span class="file-row-desc document-desc">Proposta comercial vinculada ao cliente e assinada digitalmente.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-caixa-proposta-cartao-7" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-caixa-proposta-cartao-7">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-caixa-proposta-cartao-7" />
                </label>
              </div>
              </div>
            </div>

          </div>

          <div class="section">
            <div class="section-title">
              <span>Documentos Agehab</span>
              <span class="pill"><span class="doc-counter">6</span> documentos</span>
            </div>
            <div class="section-summary">Padrões Agehab: assinaturas via GOV.BR ou Clicksign (quando aplicável).</div>


            <div class="file-row document-card" data-doc="documentos-agehab-declaracao-de-endereco-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-house"></i> Declaração de endereço</span>
                <span class="file-row-desc document-desc">Quando necessário. Assinada via GOV.BR ou Clicksign.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-agehab-declaracao-de-endereco-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-agehab-declaracao-de-endereco-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-agehab-declaracao-de-endereco-1" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-agehab-declaracao-renda-informal-2" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-money-bill-wave"></i> Declaração renda informal</span>
                <span class="file-row-desc document-desc">Assinada pelo dependente via GOV.BR/Clicksign (modelo Agehab).</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-agehab-declaracao-renda-informal-2" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-agehab-declaracao-renda-informal-2">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-agehab-declaracao-renda-informal-2" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-agehab-declaracao-de-nao-renda-3" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-money-bill-wave"></i> Declaração de não renda</span>
                <span class="file-row-desc document-desc">Para dependentes sem renda. Assinada via GOV.BR/Clicksign.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-agehab-declaracao-de-nao-renda-3" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-agehab-declaracao-de-nao-renda-3">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-agehab-declaracao-de-nao-renda-3" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-agehab-vinculo-3-anos-4" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> Vínculo ≥ 3 anos</span>
                <span class="file-row-desc document-desc">Docs com fé pública comprovando vínculo mínimo na cidade do Cheque Moradia.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-agehab-vinculo-3-anos-4" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-agehab-vinculo-3-anos-4">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-agehab-vinculo-3-anos-4" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-agehab-checklist-agehab-5" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-list-check"></i> Checklist Agehab</span>
                <span class="file-row-desc document-desc">Preenchido e assinado GOV.BR (ou próprio punho conforme orientação).</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-agehab-checklist-agehab-5" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-agehab-checklist-agehab-5">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-agehab-checklist-agehab-5" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-agehab-ficha-agehab-6" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-list-check"></i> Ficha Agehab</span>
                <span class="file-row-desc document-desc">Preenchida pelo Assistente de Crédito; assinada GOV.BR (ou próprio punho).</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-agehab-ficha-agehab-6" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-agehab-ficha-agehab-6">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-agehab-ficha-agehab-6" />
                </label>
              </div>
              </div>
            </div>

          </div>

          <div class="section" data-creditu-section>
            <div class="section-title">
              <span>Documentos Creditú</span>
              <button type="button" class="btn-primary" style="width: auto; margin-top: 0; padding: 6px 12px; font-size: 0.75rem;" data-creditu-download>Download Creditú</button>
              <span class="pill"><span class="doc-counter">7</span> documentos</span>
            </div>
            <div class="section-summary">Documentos Creditú vinculados ao processo.</div>


            <div class="file-row document-card" data-doc="documentos-creditu-tela-score-cliente-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-chart-line"></i> Tela do score do Cliente</span>
                <span class="file-row-desc document-desc">Tela do score do cliente.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-creditu-tela-score-cliente-1" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-creditu-tela-score-cliente-1">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-creditu-tela-score-cliente-1" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-creditu-rg-cpf-ou-cnh-2" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-id-card"></i> RG/CPF OU CNH</span>
                <span class="file-row-desc document-desc">Documento de identificação.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-creditu-rg-cpf-ou-cnh-2" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-creditu-rg-cpf-ou-cnh-2">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-creditu-rg-cpf-ou-cnh-2" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-creditu-tela-score-segundo-proponente-3" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-chart-line"></i> Tela do score do 2º Proponente</span>
                <span class="file-row-desc document-desc">Tela do score do 2º proponente.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-creditu-tela-score-segundo-proponente-3" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-creditu-tela-score-segundo-proponente-3">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-creditu-tela-score-segundo-proponente-3" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-creditu-email-segundo-proponente-4" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-envelope"></i> Email do 2º proponente</span>
                <span class="file-row-desc document-desc">Email do 2º proponente.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-creditu-email-segundo-proponente-4" title="Não enviado"></span>
                <input type="text" data-creditu-input="documentos-creditu-email-segundo-proponente-4" />
                <button type="button" class="btn-primary" style="width: auto; margin-top: 0; margin-left: 8px; padding-left: 16px; padding-right: 16px;" data-creditu-save="documentos-creditu-email-segundo-proponente-4">Salvar</button>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-creditu-telefone-segundo-proponente-5" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-phone"></i> Telefone do 2º proponente</span>
                <span class="file-row-desc document-desc">Telefone do 2º proponente.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-creditu-telefone-segundo-proponente-5" title="Não enviado"></span>
                <input type="text" data-creditu-input="documentos-creditu-telefone-segundo-proponente-5" />
                <button type="button" class="btn-primary" style="width: auto; margin-top: 0; margin-left: 8px; padding-left: 16px; padding-right: 16px;" data-creditu-save="documentos-creditu-telefone-segundo-proponente-5">Salvar</button>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-creditu-tela-aprovacao-creditu-6" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-circle-check"></i> Tela de aprovação do Creditú</span>
                <span class="file-row-desc document-desc">Tela de aprovação do Creditú.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-creditu-tela-aprovacao-creditu-6" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-creditu-tela-aprovacao-creditu-6">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-creditu-tela-aprovacao-creditu-6" />
                </label>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="documentos-creditu-tela-sicaq-cliente-7" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> Tela do SICAQ do cliente</span>
                <span class="file-row-desc document-desc">Tela do SICAQ do cliente.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-documentos-creditu-tela-sicaq-cliente-7" title="Não enviado"></span>
                <label class="btn-upload" id="btn-documentos-creditu-tela-sicaq-cliente-7">
                  <i class="fas fa-paperclip"></i> Anexar
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" data-doc-input="documentos-creditu-tela-sicaq-cliente-7" />
                </label>
              </div>
              </div>
            </div>

          </div>
          <div class="section">
            <div class="section-title">
              <span>Relacionamento com o banco e produto</span>
              <span class="pill"><span class="doc-counter">8</span> confirmações</span>
            </div>
            <div class="section-summary">Confirmações operacionais registradas com Sim, Não ou N/A.</div>


            <div class="file-row document-card" data-doc="relacionamento-com-o-banco-e-produto-cliente-ciente-da-portabilidade-para-a-agencia-cai-1" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-building-columns"></i> Cliente ciente da portabilidade para a agencia Caixa que vai assinar o contrato?</span>
                <span class="file-row-desc document-desc">Relacionamento Caixa</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-relacionamento-com-o-banco-e-produto-cliente-ciente-da-portabilidade-para-a-agencia-cai-1" title="Não enviado"></span>
                <select class="decision-select" data-decision-input="relacionamento-com-o-banco-e-produto-cliente-ciente-da-portabilidade-para-a-agencia-cai-1"><option value="">Selecione...</option><option>Sim</option><option>Não</option><option>N/A</option></select>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="relacionamento-com-o-banco-e-produto-cliente-ciente-que-sera-preciso-fazer-open-finance-2" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-building-columns"></i> Cliente ciente que sera preciso fazer Open Finance com a agencia Caixa?</span>
                <span class="file-row-desc document-desc">Relacionamento Caixa</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-relacionamento-com-o-banco-e-produto-cliente-ciente-que-sera-preciso-fazer-open-finance-2" title="Não enviado"></span>
                <select class="decision-select" data-decision-input="relacionamento-com-o-banco-e-produto-cliente-ciente-que-sera-preciso-fazer-open-finance-2"><option value="">Selecione...</option><option>Sim</option><option>Não</option><option>N/A</option></select>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="relacionamento-com-o-banco-e-produto-cliente-ciente-que-sera-necessario-cadastrar-o-cpf-3" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-id-card"></i> Cliente ciente que sera necessario cadastrar o CPF como Pix na agencia Caixa?</span>
                <span class="file-row-desc document-desc">Relacionamento Caixa</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-relacionamento-com-o-banco-e-produto-cliente-ciente-que-sera-necessario-cadastrar-o-cpf-3" title="Não enviado"></span>
                <select class="decision-select" data-decision-input="relacionamento-com-o-banco-e-produto-cliente-ciente-que-sera-necessario-cadastrar-o-cpf-3"><option value="">Selecione...</option><option>Sim</option><option>Não</option><option>N/A</option></select>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="relacionamento-com-o-banco-e-produto-propos-e-orientou-o-cliente-sobre-o-fgts-futuro-4" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-money-bill-wave"></i> Propos e orientou o cliente sobre o FGTS Futuro?</span>
                <span class="file-row-desc document-desc">Obrigatorio quando o cliente entrar na regra de FGTS Futuro.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-relacionamento-com-o-banco-e-produto-propos-e-orientou-o-cliente-sobre-o-fgts-futuro-4" title="Não enviado"></span>
                <select class="decision-select" data-decision-input="relacionamento-com-o-banco-e-produto-propos-e-orientou-o-cliente-sobre-o-fgts-futuro-4"><option value="">Selecione...</option><option>Sim</option><option>Não</option><option>N/A</option></select>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="relacionamento-com-o-banco-e-produto-cliente-autorizou-no-app-fgts-a-consulta-para-util-5" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-money-bill-wave"></i> Cliente autorizou no app FGTS a consulta para utilizar o FGTS Futuro?</span>
                <span class="file-row-desc document-desc">Obrigatorio quando o cliente entrar na regra de FGTS Futuro.</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-relacionamento-com-o-banco-e-produto-cliente-autorizou-no-app-fgts-a-consulta-para-util-5" title="Não enviado"></span>
                <select class="decision-select" data-decision-input="relacionamento-com-o-banco-e-produto-cliente-autorizou-no-app-fgts-a-consulta-para-util-5"><option value="">Selecione...</option><option>Sim</option><option>Não</option><option>N/A</option></select>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="relacionamento-com-o-banco-e-produto-cliente-foi-orientado-sobre-o-produto-6" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> Cliente foi orientado sobre o produto?</span>
                <span class="file-row-desc document-desc">Produto</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-relacionamento-com-o-banco-e-produto-cliente-foi-orientado-sobre-o-produto-6" title="Não enviado"></span>
                <select class="decision-select" data-decision-input="relacionamento-com-o-banco-e-produto-cliente-foi-orientado-sobre-o-produto-6"><option value="">Selecione...</option><option>Sim</option><option>Não</option><option>N/A</option></select>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="relacionamento-com-o-banco-e-produto-o-cliente-ja-pagou-o-produto-no-fechamento-7" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> O cliente ja pagou o produto no fechamento?</span>
                <span class="file-row-desc document-desc">Produto</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-relacionamento-com-o-banco-e-produto-o-cliente-ja-pagou-o-produto-no-fechamento-7" title="Não enviado"></span>
                <select class="decision-select" data-decision-input="relacionamento-com-o-banco-e-produto-o-cliente-ja-pagou-o-produto-no-fechamento-7"><option value="">Selecione...</option><option>Sim</option><option>Não</option><option>N/A</option></select>
              </div>
              </div>
            </div>


            <div class="file-row document-card" data-doc="relacionamento-com-o-banco-e-produto-cliente-saiu-ciente-que-na-assinatura-tera-que-ter-8" data-status="nao-enviado">
              <div class="file-header document-header">
              <div class="file-info">
                <span class="file-row-title document-title"><i class="fas fa-file-lines"></i> Cliente saiu ciente que na assinatura tera que ter R$ 300,00 para o produto?</span>
                <span class="file-row-desc document-desc">Produto</span>
              </div>
              <div class="file-upload-action upload-action">
                <span class="dot nao-enviado" id="dot-relacionamento-com-o-banco-e-produto-cliente-saiu-ciente-que-na-assinatura-tera-que-ter-8" title="Não enviado"></span>
                <select class="decision-select" data-decision-input="relacionamento-com-o-banco-e-produto-cliente-saiu-ciente-que-na-assinatura-tera-que-ter-8"><option value="">Selecione...</option><option>Sim</option><option>Não</option><option>N/A</option></select>
              </div>
              </div>
            </div>

          </div>
    </div>
  </div>

  <div class="notification" id="notification">
    <i class="fas fa-check-circle"></i>
    <div>
      <strong id="notificationTitle">Documento anexado</strong>
      <div id="notificationText">Arquivo selecionado com sucesso.</div>
    </div>
  </div>`;function p(e){return e.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"documento"}let u={analista:{canEditAnalysis:!0,canUpload:!1,canViewAnalystPendingAlert:!1,canCreateFormalPending:!0,canOpenReceivedUpload:!0,canMarkAttached:!1,canSendToConformity:!1},corretor:{canEditAnalysis:!1,canUpload:!0,canViewAnalystPendingAlert:!0,canCreateFormalPending:!1,canOpenReceivedUpload:!1,canMarkAttached:!1,canSendToConformity:!1},gestor:{canEditAnalysis:!1,canUpload:!0,canViewAnalystPendingAlert:!0,canCreateFormalPending:!1,canOpenReceivedUpload:!1,canMarkAttached:!1,canSendToConformity:!1},cca:{canEditAnalysis:!1,canUpload:!1,canViewAnalystPendingAlert:!0,canCreateFormalPending:!1,canOpenReceivedUpload:!0,canMarkAttached:!0,canSendToConformity:!0}};function f(e,a){let o,t=e.indexOf(`<span>${a}</span>`);if(t<0)return e;let i=e.lastIndexOf('<div class="section"',t);if(i<0)return e;let n=/<\/?div\b[^>]*>/g;n.lastIndex=i;let d=0;for(;o=n.exec(e);)if(0===(d+=o[0].startsWith("</")?-1:1))return`${e.slice(0,i)}${e.slice(n.lastIndex)}`;return e}function m({perfil:e,modo:a,reserva:o,cliente:c,documentos:v,ocultarAteInicializar:g=!1}={}){let b=(0,i.useRef)(null),h=(0,n.usePathname)(),x=e||(h?.includes("/analista")?"analista":h?.includes("/gestor")?"gestor":h?.includes("/cca")?"cca":"corretor"),w=u[x],y=(0,i.useMemo)(()=>new URLSearchParams(window.location.search),[]),k=(0,i.useMemo)(()=>{let e="corretor"===x?l.replace(/accept="\.pdf,.jpg,.jpeg,.png"/g,'accept=".pdf"'):l,a=["analista","cca"].includes(x)?'<button type="button" class="btn-primary" style="width: auto; margin-top: 12px; padding: 8px 14px; font-size: 0.78rem;" data-kit-caixa-download><i class="fas fa-file-pdf"></i> Download Kit Caixa</button>':"",o="analista"===x?'<button type="button" class="btn-primary" style="width: auto; margin-top: 12px; margin-left: 8px; padding: 8px 14px; font-size: 0.78rem;" data-kit-agehab-download><i class="fas fa-file-pdf"></i> Download Kit AGEHAB</button>':"";return(e=(e=e.replace("<div data-kit-caixa-download-slot></div>",`<div data-kit-caixa-download-slot>${a}${o}</div>`)).replace(/href="\/corretor"/g,`href="${"gestor"===x?"/gestor/telemetria":"analista"===x?"/analista":"cca"===x?"/cca/acompanhamento":"/corretor"}"`),"analista"!==x&&(e=e.replace(/\s*<span class="status-chip" data-status-kind="caixa">Caixa <select id="caixaStatus">[\s\S]*?<\/select><\/span>/,"").replace(/\s*<span class="status-chip" data-status-kind="agehab">Agehab <select id="agehabStatus">[\s\S]*?<\/select><\/span>/,"")),"cca"===x&&(e=f(e=e.replace(/\s*<div class="section" data-creditu-section>[\s\S]*?(?=<div class="section">\s*<div class="section-title">\s*<span>Relacionamento com o banco e produto<\/span>)/,""),"Documentos Agehab"),e=f(e,"Relacionamento com o banco e produto")),w.canUpload)?e:e.replace(/<i class="fas fa-paperclip"><\/i>\s*Anexar\s*<input[^>]*data-doc-input="[^"]+"[^>]*>/g,'<i class="fas fa-clock"></i> Aguardando upload').replace(/<i class="fas fa-rotate"><\/i>\s*Corrigir e reenviar\s*<input[^>]*data-doc-input="[^"]+"[^>]*>/g,'<i class="fas fa-clock"></i> Aguardando upload')},[w.canUpload,x]);return(0,i.useEffect)(()=>{let e=b.current;if(!e)return;let a=new URLSearchParams(window.location.search),o=a.get("reserva")||"",t=`maq2_workflow_docs_${o||"sem-reserva"}`,i=["analista","corretor","gestor","cca"].includes(x),n=w.canOpenReceivedUpload&&!w.canUpload,d="gestor"===x?"gestor":"corretor",c="corretor"===x?".pdf":".pdf,.jpg,.jpeg,.png",l=0,u={},f=()=>{n&&e.querySelectorAll(".file-row[data-doc]").forEach(e=>{let a=e.querySelector(".btn-upload"),o=e.querySelector(".dot");o&&(o.className="dot nao-enviado",o.title="Aguardando upload do corretor ou gestor"),a&&(a.classList.remove("pending","uploaded","rejected"),a.innerHTML='<i class="fas fa-clock"></i> Aguardando upload',a.style.pointerEvents="none",a.setAttribute("aria-disabled","true"),a.onclick=null)})},m=(a,o)=>{let t=e.querySelector(`#${a}`);t&&o&&(t.value=o)};m("nomeCompleto",a.get("cliente")),m("numeroReserva",o),m("empreendimento",a.get("empreendimento")),m("corretor",a.get("corretor")),m("sinalOk",a.get("sinal")),m("fiadorOk",a.get("fiador")),m("produto",a.get("produto")),"cca"===x&&e.querySelector("[data-creditu-section]")?.remove();let v=e.querySelector("#notification"),h=e.querySelector("#notificationTitle"),y=e.querySelector("#notificationText"),k=e.querySelector("#totalEnviados"),A=(e,a,o=2800)=>{v&&h&&y&&(h.textContent=e,y.textContent=a,v.classList.add("show"),window.clearTimeout(l),l=window.setTimeout(()=>v.classList.remove("show"),o))},S=["Documento","Descri\xe7\xe3o","Origem","Pessoa","Situa\xe7\xe3o","Prazo","A\xe7\xf5es"],C={IDLE:"Aguardando aprova\xe7\xe3o",ENVIADO:"Em an\xe1lise",EM_ANALISE:"Em an\xe1lise",PENDENTE:"Pendente",APROVADO:"Aprovado",REPROVADO:"Reprovado",NAO_SE_APLICA:"Aprovado"},E=(a,o)=>{let t=Array.from(e.querySelectorAll(".file-row[data-doc]")).find(e=>e.dataset.doc===a),i=t?.querySelector("[data-doc-status-pill]");if(!i)return;let n=!!(o||"").trim();i.className=`doc-status-pill ${n?"status-aprovado":"status-idle"}`,i.textContent="documentos-creditu-email-segundo-proponente-4"===a?n?"EMAIL SALVO":"AGUARDANDO EMAIL":n?"TELEFONE SALVO":"AGUARDANDO TELEFONE"},N=["Item","Descri\xe7\xe3o","Origem","Resposta","A\xe7\xf5es"],q=e=>{let a=String(e||"").trim().toLowerCase();return"sim"===a?"Sim":"n\xe3o"===a||"nao"===a?"N\xe3o":"n/a"===a||"nao se aplica"===a||"n\xe3o se aplica"===a?"N/A":"N\xe3o respondido"},L=()=>{e.querySelectorAll(".doc-action-menu.is-open").forEach(e=>e.classList.remove("is-open")),e.querySelectorAll(".relationship-answer-menu.is-open").forEach(e=>e.classList.remove("is-open"))},j=(e,a)=>{let o=e.querySelector("[data-relationship-response]");if(o){let e;o.className=`relationship-response-pill ${"sim"===(e=String(a||"").trim().toLowerCase())?"response-sim":"n\xe3o"===e||"nao"===e?"response-nao":"n/a"===e||"nao se aplica"===e||"n\xe3o se aplica"===e?"response-na":"response-empty"}`,o.textContent=q(a)}},D=e=>{u=e;try{window.localStorage.setItem(t,JSON.stringify(e))}catch{}window.dispatchEvent(new CustomEvent("maq2-workflow-updated"))},z=async(t=!1)=>{if(!o)return;let i=e.querySelector("#caixaStatus")?.value||"reserva",n=e.querySelector("#agehabStatus")?.value||"reserva",d={caixa:"cca"===x&&e.querySelector("#ccaEnviadoConformidade")?.checked?"envio_conformidade":i,agehab:n,cliente:e.querySelector("#nomeCompleto")?.value||a.get("cliente"),empreendimento:e.querySelector("#empreendimento")?.value||a.get("empreendimento"),corretor:e.querySelector("#corretor")?.value||a.get("corretor"),produto:e.querySelector("#produto")?.value||a.get("produto"),sinal:e.querySelector("#sinalOk")?.value||a.get("sinal"),fiador:e.querySelector("#fiadorOk")?.value||a.get("fiador")};if(t&&(d.encaminhado_analista=!0),!(await fetch(`/api/processos/${encodeURIComponent(o)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)})).ok)throw Error("Nao foi possivel salvar o processo.")},P=()=>{k&&(k.textContent=String(e.querySelectorAll('.file-row[data-status="em-analise"], .file-row[data-status="aprovado"]').length))},R=s.map(e=>e.key),O=r.map(e=>e.key),T={caixa:{reserva:"Cliente em reserva. Aguardando inicio da analise de credito.",em_analise_credito:"Credito em analise. Conferir documentacao e retorno das validacoes.",emitindo_formularios:"Formularios em emissao pelo CCA para assinatura do cliente.",formularios_em_assinatura:"Formularios enviados para assinatura. Acompanhar devolucao assinada.",formularios_assinados:"Formularios assinados. Preparar envio para conformidade.",envio_conformidade:"Kit Caixa finalizado e enviado para conformidade."},agehab:{reserva:"Cliente em reserva. Aguardando inicio da analise de credito.",em_analise_credito:"Credito em analise. Validar criterios antes da ficha Agehab.",ficha_emitida:"Ficha Agehab emitida. Aguardando assinatura ou retorno do cliente.",ficha_recebida:"Ficha Agehab recebida. Conferir dados e documentos obrigatorios.",em_validacao_agehab:"Processo em validacao na Agehab. Acompanhar retorno da analise.",agehab_validada:"Agehab validada. Etapa concluida para este cliente."}},_=(a,o,t,i="caixa")=>{let n=e.querySelector(a);if(!n)return;let d=o.includes(t||"")&&t||"reserva",s=Math.max(0,o.indexOf(d));n.dataset.currentStage=d;let r=Array.from(n.querySelectorAll(".kit-step"));r.forEach((e,a)=>{let o=a<s?"done":a===s?"active":"pending";e.classList.toggle("done","done"===o),e.classList.toggle("active","active"===o),e.classList.toggle("pending","pending"===o),e.dataset.state=o;let t=e.querySelector(".kit-dot");t&&(t.textContent="done"===o?"✓":String(a+1))});let c=n.querySelector(".kit-progress-fill");c&&(c.style.width=`${o.length>1?s/(o.length-1)*100:0}%`);let l=r[s]?.querySelector(".kit-step-label")?.textContent?.trim();e.querySelectorAll(`[data-stage-badge="${i}"]`).forEach(e=>{l&&(e.textContent=l)});let p=n.querySelector("[data-stage-description]");p&&(p.textContent=T[i][d]||T[i].reserva);let u=e.querySelector("caixa"===i?"#caixaStatus":"#agehabStatus");if(u&&(u.value="envio_conformidade"===d?"formularios_assinados":d),"caixa"===i){let a=e.querySelector("#ccaEnviadoConformidade");a&&(a.checked="envio_conformidade"===d)}},I=e=>{if(!e)return"";let a=new Date(e);return Number.isNaN(a.getTime())?e:a.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})},$=e=>{if(!e)return!1;try{let a=new URL(e,window.location.origin);return"https:"===a.protocol||a.origin===window.location.origin}catch{return!1}},F=e=>{if(!e)return"";try{let a=new URL(e,window.location.origin);if(a.pathname.startsWith("/api/processos/"))return`${a.pathname}${a.search}`;return e}catch{return e.startsWith("/api/processos/")?e:""}},U=e=>{e&&(e.style.height="auto",e.style.height=`${e.scrollHeight}px`)},M=async(e,a,t="analista")=>{if(!o)throw Error("Reserva nao informada.");if(!(await fetch(`/api/processos/${encodeURIComponent(o)}/documentos/${encodeURIComponent(e)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:a,updated_by:t})})).ok)throw Error("Nao foi possivel salvar o status do documento.")},V=async(e,a,t)=>{if(!o)throw Error("Reserva nao informada.");let i=await fetch(`/api/processos/${encodeURIComponent(o)}/documentos/${encodeURIComponent(e)}/pendencia`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({descricao:a,prazo:t,documento:e,origem:"analista",destinoCard:"card1"})});if(!i.ok)throw Error((await i.json().catch(()=>({}))).detail||"Nao foi possivel salvar a pendencia.")},H={analista:"Analista",corretor:"Corretor",gestor:"Gestor",cca:"CCA",todos:"Todos"},G=e=>{let a=String(e||"todos").toLowerCase();return H[a]?a:"todos"},B=()=>`/api/processos/${encodeURIComponent(o)}/messages`,W=(e,a)=>{let o=e.querySelector(".doc-chat-list");if(!o)return;let t=a.filter(e=>{let a=G(e.targetRole||e.target_role);return"todos"===a||e.author_role===x||a===x||"gestor"===x});if(!t.length){o.innerHTML='<div class="doc-chat-empty">Sem mensagens neste processo.</div>';return}o.innerHTML=t.map(e=>{let a=e.author_role===x?" mine":"",o=H[e.author_role]||e.author_role||"-",t=G(e.targetRole||e.target_role),i=H[t]||e.targetLabel||t;return`<div class="doc-chat-message${a}">
          <span class="doc-chat-meta">${o.toUpperCase()} &rarr; ${i.toUpperCase()} &bull; ${(e=>{if(!e)return"";let a=new Date(e);return Number.isNaN(a.getTime())?e:a.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})})(e.created_at)}</span>
          <div>${String(e.message||"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]||e)}</div>
        </div>`}).join(""),o.scrollTop=o.scrollHeight},K=async()=>{if(!o)return[];let a=await fetch(B(),{headers:{Accept:"application/json"},cache:"no-store"});if(!a.ok)throw Error("Nao foi possivel carregar mensagens.");let t=await a.json();return e.querySelector("#btnProcessChat .doc-chat-count").textContent=t.length?String(t.length):"",t},J=async()=>{let a=e.querySelector(".doc-chat-panel");if(a)return void a.remove();let o=e.querySelector(".header-actions");if(o){(a=document.createElement("div")).className="doc-chat-panel",a.innerHTML=`
        <div class="doc-chat-list"><div class="doc-chat-empty">Carregando mensagens...</div></div>
        <div class="doc-chat-compose">
          <select aria-label="Enviar para">
            <option value="todos">Todos</option>
            <option value="analista">Analista</option>
            <option value="corretor">Corretor</option>
            <option value="gestor">Gestor</option>
            <option value="cca">CCA</option>
          </select>
          <textarea placeholder="Escreva uma mensagem para o CCA..."></textarea>
          <button type="button">Enviar mensagem</button>
        </div>
      `,o.insertAdjacentElement("afterend",a);try{W(a,await K())}catch(e){A("Erro",e instanceof Error?e.message:"Nao foi possivel carregar mensagens.",3600)}a.querySelector(".doc-chat-compose button")?.addEventListener("click",async()=>{let o,t=a.querySelector(".doc-chat-compose select")?.value||"todos",i=a.querySelector("textarea"),n=i?.value.trim()||"";n&&((await fetch(B(),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({author_name:(o=e.querySelector("#corretor")?.value?.trim(),"corretor"===x&&o?o:x.charAt(0).toUpperCase()+x.slice(1)),author_role:x,targetRole:t,message:n})})).ok?(i&&(i.value=""),W(a,await K())):A("Erro","Nao foi possivel enviar mensagem.",3600))})}},Y=(a,o)=>{let t=a.dataset.doc||"",i=a.querySelector(".dot"),d=a.querySelector(".btn-upload");if(!i||!d)return;let s=o?.status||"IDLE";a.querySelector(".pendency-note")?.remove();let r=a.querySelector(".analyst-review"),l=r?.querySelector(".file-upload-action"),p=a.querySelector(".file-header");l&&p&&p.appendChild(l),p?.querySelector(".document-status-badge")?.remove(),r?.remove(),a.dataset.status="APROVADO"===s?"aprovado":"PENDENTE"===s?"pendenciado":"ENVIADO"===s?"enviado":"EM_ANALISE"===s?"em-analise":"nao-enviado";let f=a.querySelector("[data-doc-status-pill]");if(f){let e=C[s]||s;f.className=`doc-status-pill status-${String(s||"IDLE").toLowerCase().replace(/_/g,"-")}`,f.textContent=e}let m=a.querySelector("[data-doc-deadline]");if(m&&(m.innerHTML=(e=>{if(!e)return'<span class="doc-muted">-</span>';let a=new Date(e);if(Number.isNaN(a.getTime()))return`<span class="doc-muted">${e}</span>`;let o=a.getTime()-Date.now();return`<span class="doc-muted">${I(e)}</span>${o<0?'<span class="doc-deadline-badge deadline-late">Em atraso</span>':o<=864e5?'<span class="doc-deadline-badge deadline-near">Pr\xf3ximo do prazo</span>':'<span class="doc-deadline-badge deadline-ok">No prazo</span>'}`})(o?.prazo)),d.classList.remove("pending","uploaded","rejected"),d.onclick=null,w.canViewAnalystPendingAlert&&(o?.observacao||o?.descricao||o?.prazo)){let e=a.querySelector(".file-row-desc"),t=o?.observacao||o?.descricao||"Documento pendenciado pelo analista.";if(e){let a=document.createElement("span");a.className="pendency-note",a.innerHTML=`Pendencia: ${t}${o?.prazo?`<small>Prazo: ${I(o.prazo)}</small>`:""}`,e.insertAdjacentElement("afterend",a)}}if(n){i.className="APROVADO"===s?"dot aprovado":"PENDENTE"===s?"dot rejeitado":"ENVIADO"===s||"EM_ANALISE"===s?"dot em-analise":"dot nao-enviado",i.title="IDLE"===s?"Aguardando upload do corretor ou gestor":"Upload recebido do corretor ou gestor",d.style.pointerEvents="",d.removeAttribute("aria-disabled"),$(o?.fileUrl)?(d.classList.add("APROVADO"===s?"uploaded":"PENDENTE"===s?"rejected":"pending"),d.innerHTML='<i class="fas fa-folder-open"></i> Documentos',d.onclick=e=>{e.preventDefault(),e.stopPropagation(),window.open(o.fileUrl,"_blank","noopener,noreferrer")},w.canEditAnalysis&&((a,o)=>{let t=a.querySelector(".analyst-review"),i=a.querySelector(".file-header"),n=t?.querySelector(".file-upload-action");if(n&&i&&i.appendChild(n),i?.querySelector(".document-status-badge")?.remove(),t?.remove(),!w.canEditAnalysis||!$(o?.fileUrl))return;let d=a.dataset.doc||"",s=a.querySelector(".file-header");if(!d||!s)return;let r=document.createElement("div");r.className="analyst-review",r.innerHTML=`
        <div class="document-inner">
          <div class="document-body">
            <div class="document-left">
              <div class="document-field">
                <label>Status</label>
                <select data-review-status>
                  <option value="">Analisar documento...</option>
                  <option value="Aprovado">Aprovar</option>
                  <option value="Nao se Aplica">N\xe3o se Aplica</option>
                  <option value="Pendente">Pendenciar</option>
                </select>
              </div>
              <div data-pendency-box hidden>
                <div class="document-field">
                  <label>Prazo</label>
                  <input type="datetime-local" />
                </div>
              </div>
            </div>
            <div class="document-right">
              <div data-pendency-box hidden>
                <div class="document-field">
                  <label>Observacao</label>
                  <textarea placeholder="Descreva a pendencia para o Card 1"></textarea>
                </div>
              </div>
              <div class="document-actions">
                <button type="button">Enviar pendencia</button>
              </div>
            </div>
          </div>
        </div>
      `,s.insertAdjacentElement("afterend",r),s.querySelector(".document-status-badge")?.remove();let c=document.createElement("span");c.className="document-status-badge",c.textContent=o?.status==="APROVADO"?"Aprovado":o?.status==="PENDENTE"?"Pendente":"Em analise",e.classList.contains("document-table-mode")||s.appendChild(c);let l=a.querySelector(".file-upload-action"),p=r.querySelector(".document-actions"),f=r.querySelector(".document-actions > button");if(l&&p&&!e.classList.contains("document-table-mode")){let e=l.querySelector(".dot"),a=l.querySelector(".btn-upload");e&&a&&e.parentElement!==a&&a.prepend(e),p.insertBefore(l,f||null)}e.classList.contains("document-table-mode")&&(r.hidden=!0);let m=r.querySelector("[data-review-status]"),v=Array.from(r.querySelectorAll("[data-pendency-box]")),g=r.querySelector("textarea"),b=r.querySelector('input[type="datetime-local"]'),h=r.querySelector("button");o?.status==="APROVADO"&&(m.value="Aprovado"),(o?.status==="NAO_SE_APLICA"||o?.status==="N\xc3O SE APLICA"||o?.status==="Nao se Aplica")&&(m.value="Nao se Aplica"),o?.status==="PENDENTE"&&(m.value="Pendente",v.forEach(e=>{e.hidden=!1}),g&&(g.value=o?.observacao||o?.descricao||""),b&&(b.value=o?.prazo||""),U(g)),g?.addEventListener("input",()=>U(g)),m?.addEventListener("change",async()=>{if("Pendente"===m.value){v.forEach(e=>{e.hidden=!1}),U(g);return}if("Aprovado"===m.value||"Nao se Aplica"===m.value)try{await M(d,m.value);let e=u;e[d]={...e[d]||o||{},status:"Nao se Aplica"===m.value?"NAO_SE_APLICA":"APROVADO",updatedAt:new Date().toISOString()},D(e),A("Status salvo","Status salvo no processo.")}catch(e){A("Erro",e instanceof Error?e.message:"Nao foi possivel salvar.",4200)}}),h?.addEventListener("click",async()=>{let e=g?.value.trim()||"";if(!e)return void A("Pendencia obrigatoria","Descreva a pendencia antes de enviar.",3600);try{await M(d,"Pendente"),await V(d,e,b?.value||"");let a=u;a[d]={...a[d]||o||{},status:"PENDENTE",observacao:e,prazo:b?.value||"",updatedAt:new Date().toISOString()},D(a),A("Pendencia enviada","Pendencia salva e enviada para o Card 1.")}catch(e){A("Erro",e instanceof Error?e.message:"Nao foi possivel salvar a pendencia.",4200)}})})(a,o)):(d.innerHTML='<i class="fas fa-clock"></i> Documentos',d.style.pointerEvents="none",d.setAttribute("aria-disabled","true"));return}if("ENVIADO"===s||"EM_ANALISE"===s){i.className="dot em-analise",i.title="Enviado para analise",d.classList.add("pending"),d.innerHTML='<i class="fas fa-lock"></i> Enviado',d.style.pointerEvents="none",d.setAttribute("aria-disabled","true");return}if("APROVADO"===s){i.className="dot aprovado",i.title="Aprovado pelo analista",d.classList.add("uploaded"),d.innerHTML='<i class="fas fa-lock"></i> Aprovado',d.style.pointerEvents="none",d.setAttribute("aria-disabled","true");return}if("PENDENTE"===s){i.className="dot rejeitado",i.title=o?.observacao||"Pendenciado pelo analista",d.classList.add("rejected"),d.style.pointerEvents="",d.removeAttribute("aria-disabled"),d.innerHTML='<i class="fas fa-rotate"></i> Corrigir e reenviar <input type="file" accept="'+c+'" data-doc-input="'+t+'" />',X(d.querySelector("input[data-doc-input]"));return}i.className="dot nao-enviado",i.title="Nao enviado",d.style.pointerEvents="",d.removeAttribute("aria-disabled"),d.innerHTML='<i class="fas fa-paperclip"></i> Anexar <input type="file" accept="'+c+'" data-doc-input="'+t+'" />',X(d.querySelector("input[data-doc-input]"))},Q=async(e,t)=>{if(!o)throw Error("Reserva nao informada.");let i=new FormData,n=a.get("corretor")||"corretor",s=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,""),r=t.name.includes(".")?t.name.slice(t.name.lastIndexOf(".")).toLowerCase():"";i.append("grupo",d),i.append("key",e),i.append("name",`${p(e)}-${s}-${p(n)}${r}`),i.append("file",t);let c=await fetch(`/api/processos/${encodeURIComponent(o)}/uploads`,{method:"POST",body:i});if(!c.ok){let e=await c.json().catch(()=>({}));throw Error(e.detail||e.error||"Falha ao enviar documento.")}return c.json()};function X(t){t&&"true"!==t.dataset.workflowWired&&(t.dataset.workflowWired="true",t.addEventListener("change",async i=>{i.stopImmediatePropagation();let n=t.dataset.docInput||"",d=Array.from(e.querySelectorAll(".file-row[data-doc]")).find(e=>e.dataset.doc===n),s=t.files?.[0];if(!n||!d||!s)return;if("corretor"===x&&"application/pdf"!==s.type&&!s.name.toLowerCase().endsWith(".pdf")){t.value="",A("Arquivo invalido","Anexe apenas arquivos PDF.",3600);return}let r=d.querySelector(".btn-upload");r&&(r.classList.add("pending"),r.innerHTML='<i class="fas fa-spinner fa-spin"></i> Enviando...'),A("Salvando documento","Enviando arquivo para CCA e analista...",6e3);try{await z();let i=await Q(n,s),r=u;r[n]={status:"ENVIADO",nome:d.querySelector(".file-row-title")?.textContent?.replace(/\s+/g," ").trim()||d.getAttribute("data-doc")||"Documento",categoria:d.closest(".section")?.querySelector(".section-title")?.textContent?.replace(/\s+/g," ").trim()||"Documento",cliente:e.querySelector("#nomeCompleto")?.value||a.get("cliente")||"Cliente",reserva:o,fileName:s.name,fileUrl:F(i.url)||window.location.href,updatedAt:new Date().toISOString()},D(r),fetch(`/api/processos/${encodeURIComponent(o)}/documentos/${encodeURIComponent(n)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"Enviado",updated_by:x})}),Y(d,r[n]),A("Documento enviado",`${s.name} enviado para analise.`,3200),P(),t.value=""}catch(e){A("Erro no envio",e instanceof Error?e.message:"Nao foi possivel enviar o documento.",4200),Y(d,u[n])}},!0))}let Z=()=>{e.querySelectorAll(".file-row[data-doc]").forEach(e=>{try{Y(e,u[e.dataset.doc||""])}catch(a){console.error("[CHECKLIST_PAINT_ERROR]",e.dataset.doc,a)}}),P()},ee=async()=>{if(!o)return void f();try{let i={};try{let e=JSON.parse(window.localStorage.getItem(t)||"{}");i=e&&"object"==typeof e&&!Array.isArray(e)?e:{}}catch{i={}}let n=await fetch(`/api/processos/${encodeURIComponent(o)}`,{headers:{Accept:"application/json"},cache:"no-store"});if(!n.ok)throw Error(`Erro ao carregar processo: ${n.status}`);let d=await n.json();m("nomeCompleto",d.cliente||a.get("cliente")),m("empreendimento",d.empreendimento||a.get("empreendimento")),m("corretor",d.corretor||a.get("corretor")),m("produto",d.produto||a.get("produto")),m("sinalOk",d.sinal||a.get("sinal")),m("fiadorOk",d.fiador||a.get("fiador")),_(".kit-caixa",R,d.caixa,"caixa"),_(".kit-agehab",O,d.agehab,"agehab");let s={...i};Object.entries(d.uploadsEnviados||{}).forEach(([e,a])=>{if(!a)return;let t=d.uploadsCca?.[e]||{};s[e]={...s[e]||{},status:"ENVIADO",reserva:o,fileName:t.name||s[e]?.fileName,fileUrl:F(t.data||s[e]?.fileUrl),updatedAt:s[e]?.updatedAt||new Date().toISOString()}}),Object.entries(d.documentos||{}).forEach(([e,a])=>{let t,i=d.pendencias?.[e]||{},n=(t=(String(a)||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()).includes("aguardando")?"IDLE":t.includes("aprovado")||t.includes("nao se aplica")?"APROVADO":t.includes("pendente")||t.includes("bloqueado")?"PENDENTE":t.includes("analise")||t.includes("enviado")?"ENVIADO":"IDLE",r=!!(i.descricao||i.prazo)&&"PENDENTE"===n;s[e]={...s[e]||{},status:r?"PENDENTE":n,reserva:o,observacao:r?i.descricao||s[e]?.observacao:void 0,prazo:r?i.prazo||s[e]?.prazo:void 0,updatedAt:s[e]?.updatedAt||new Date().toISOString()}}),Object.entries(d.relacionamento||{}).forEach(([a,o])=>{let t=Array.from(e.querySelectorAll("[data-decision-input]")).find(e=>e.dataset.decisionInput===a);if(t&&"string"==typeof o){t.value="N\xe3o respondido"===q(o)?"":q(o);let e=t.closest(".file-row[data-doc]");e&&j(e,o)}});let r=d.creditu||{},c=e.querySelector('[data-creditu-input="documentos-creditu-email-segundo-proponente-4"]'),l=e.querySelector('[data-creditu-input="documentos-creditu-telefone-segundo-proponente-5"]');c&&(c.value=r.email_segundo_proponente||""),l&&(l.value=r.telefone_segundo_proponente||""),E("documentos-creditu-email-segundo-proponente-4",c?.value||""),E("documentos-creditu-telefone-segundo-proponente-5",l?.value||""),D(s),Z()}catch(e){console.error("[CHECKLIST_LOAD_ERROR]",e),A("Atencao",e instanceof Error?e.message:"Nao foi possivel carregar o checklist do banco.",4200)}},ea=e.querySelector("#tipoDependente"),eo=e.querySelector("#dependenteCasadoGroup"),et=e.querySelector("#dependenteCasado"),ei=e.querySelector("#tipoRenda"),en=e.querySelector("#btnSalvar"),ed=e.querySelector("#btnAcompanhar"),es=e.querySelector("#btnProcessChat"),er=e.querySelector("#caixaStatus"),ec=e.querySelector("#agehabStatus"),el=e.querySelector("[data-cca-conformidade-chip]"),ep=e.querySelector("#ccaEnviadoConformidade");el&&(el.hidden="cca"!==x);let eu=()=>{ea&&eo&&et&&("filho_menor"===ea.value?(eo.classList.add("hidden"),et.value="nao"):eo.classList.remove("hidden"))},ef=()=>{ei&&e.querySelectorAll('[data-doc*="nao-renda"], [data-doc*="declaracao-renda-informal"]').forEach(e=>{"informal"===ei.value&&e.classList.remove("hidden")})},em=()=>{_(".kit-caixa",R,er?.value||"reserva","caixa"),ep&&(ep.checked=!1)},ev=()=>{_(".kit-agehab",O,ec?.value||"reserva","agehab")},eg=()=>{ep?.checked?_(".kit-caixa",R,"envio_conformidade","caixa"):_(".kit-caixa",R,er?.value||"formularios_assinados","caixa")},eb=()=>{let e=en?.innerHTML||"";en&&(en.disabled=!0,en.innerHTML='<i class="fas fa-spinner fa-spin"></i> Salvando...'),z(!0).then(()=>A("Dados salvos","Cadastro enviado para a tela do analista.")).catch(()=>A("Erro","Nao foi possivel salvar no banco.",4200)).finally(()=>{en&&(en.disabled=!1,en.innerHTML=e)})},eh=()=>{window.location.href="/corretor"};return ea?.addEventListener("change",eu),ei?.addEventListener("change",ef),er?.addEventListener("change",em),ec?.addEventListener("change",ev),ep?.addEventListener("change",eg),en?.addEventListener("click",eb),ed?.addEventListener("click",eh),es?.addEventListener("click",J),K().catch(()=>void 0),i&&(e.classList.add("document-table-mode"),e.querySelectorAll(".section").forEach(e=>{let a=Array.from(e.querySelectorAll(":scope > .file-row[data-doc]"));if(!a.length||e.querySelector(".document-table-wrap"))return;let t=(e.querySelector(".section-title")?.textContent?.replace(/\s+/g," ").trim()||"").toLowerCase().includes("relacionamento com o banco e produto"),i=document.createElement("div");i.className="document-table-wrap";let n=document.createElement("div");if(n.className="document-table-header",n.innerHTML=(t?N:S).map(e=>`<span>${e}</span>`).join(""),e.insertBefore(i,a[0]),i.appendChild(n),t){e.classList.add("relationship-table"),a.forEach(e=>{let a=e.querySelector(".file-header"),t=e.querySelector(".file-info"),n=e.querySelector(".file-row-desc"),d=e.querySelector("[data-decision-input]");if(!a||!t||!n||!d)return;a.classList.add("document-table-grid"),d.classList.add("relationship-native-select");let s=(n.textContent||"").toLowerCase().includes("produto")?"Complementar":"Caixa",r=(e,a="")=>{let o=document.createElement("div");return o.className=`document-table-cell ${e}`,a&&(o.innerHTML=a),o},c=r("doc-description-cell");if(c.appendChild(n),(n.textContent||"").trim().length>100){let e=document.createElement("button");e.type="button",e.className="doc-description-toggle",e.textContent="Ver mais",e.addEventListener("click",()=>{e.textContent=n.classList.toggle("is-expanded")?"Ver menos":"Ver mais"}),c.appendChild(e)}let l=r("doc-origin-cell",`<span class="doc-muted">${s}</span>`),p=r("relationship-response-cell",'<span class="relationship-response-pill" data-relationship-response>N\xe3o respondido</span>'),u=r("relationship-actions-cell"),f=document.createElement("div");f.className="relationship-answer-menu",f.innerHTML=`
              <button type="button" class="relationship-answer-trigger">Responder</button>
              <div class="relationship-answer-dropdown">
                <button type="button" data-relationship-answer="Sim">Sim</button>
                <button type="button" data-relationship-answer="N\xe3o">N\xe3o</button>
                <button type="button" data-relationship-answer="N/A">N/A</button>
              </div>
            `,f.querySelector(".relationship-answer-trigger")?.addEventListener("click",e=>{e.preventDefault(),e.stopPropagation();let a=f.classList.contains("is-open");L(),a||f.classList.add("is-open")}),f.querySelectorAll("[data-relationship-answer]").forEach(a=>{a.addEventListener("click",async t=>{t.preventDefault(),t.stopPropagation();let i=a.dataset.relationshipAnswer||"";if(d.value=i,j(e,i),L(),o&&d.dataset.decisionInput)try{let e="N/A"===i?"Nao se Aplica":i;if(!(await fetch(`/api/processos/${encodeURIComponent(o)}/relacionamento/${encodeURIComponent(d.dataset.decisionInput)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:e,updated_by:x})})).ok)throw Error("Nao foi possivel salvar a resposta.")}catch(e){A("Erro",e instanceof Error?e.message:"Nao foi possivel salvar a resposta.",3600)}})}),d.addEventListener("change",()=>j(e,d.value)),u.append(f,d),a.innerHTML="",a.append(t,c,l,p,u),i.appendChild(e),j(e,d.value)});return}a.forEach(a=>{var o,t;let n,d,s=a.querySelector(".file-header"),r=a.querySelector(".file-info"),c=a.querySelector(".file-row-desc"),l=a.querySelector(".file-upload-action");if(!s||!r||!c||!l)return;s.classList.add("document-table-grid");let p=a.querySelector(".file-row-title")?.textContent?.replace(/\s+/g," ").trim()||a.dataset.doc||"Documento",u=e.querySelector(".section-title")?.textContent?.replace(/\s+/g," ").trim()||"Documento",f=(o=a.dataset.doc||"",(n=`${o} ${u} ${p}`.toLowerCase()).includes("agehab")?"AGEHAB":n.includes("declarante")?"Declara\xe7\xe3o":n.includes("caixa")||n.includes("proponente")||n.includes("dependente")?"Caixa":"Complementar"),m=(t=a.dataset.doc||"",(d=`${t} ${u} ${p}`.toLowerCase()).includes("declarante")?"Declarante":d.includes("dependente")||d.includes("conjuge")||d.includes("c\xf4njuge")||d.includes("estado-civil")||d.includes("certidao-de-casamento")?"Dependente":d.includes("agehab")?"Benefici\xe1rio":d.includes("documentos-do-proponente")||d.includes("proponente")||d.includes("documentos-caixa")?"Proponente":"-"),v=(e,a="")=>{let o=document.createElement("div");return o.className=`document-table-cell ${e}`,a&&(o.innerHTML=a),o},g=v("doc-description-cell");if(g.appendChild(c),(c.textContent||"").trim().length>120){let e=document.createElement("button");e.type="button",e.className="doc-description-toggle",e.textContent="Ver mais",e.addEventListener("click",()=>{e.textContent=c.classList.toggle("is-expanded")?"Ver menos":"Ver mais"}),g.appendChild(e)}let b=v("doc-origin-cell",`<span class="doc-muted" title="${f}">${f}</span>`),h=v("doc-person-cell",`<span class="doc-muted" title="${m}">${m}</span>`),x=v("doc-status-cell",'<span class="doc-status-pill status-idle" data-doc-status-pill>Aguardando aprova\xe7\xe3o</span>'),w=v("doc-deadline-cell","<span data-doc-deadline>-</span>"),y=v("doc-options-cell"),k=document.createElement("div");k.className="doc-action-menu",k.innerHTML=`
            <button type="button" class="doc-action-trigger" aria-haspopup="menu">A\xe7\xf5es</button>
            <div class="doc-action-dropdown" role="menu">
              <button type="button" data-doc-action="view">Visualizar Documento</button>
              <button type="button" data-doc-action="review">Aprovar / Reprovar</button>
              <button type="button" data-doc-action="download">Baixar Documento</button>
              <button type="button" data-doc-action="delete">Excluir Documento</button>
              <button type="button" data-doc-action="pending">Enviar pend\xeancia</button>
            </div>
          `,k.querySelector(".doc-action-trigger")?.addEventListener("click",e=>{e.preventDefault(),e.stopPropagation();let a=k.classList.contains("is-open");L(),a||k.classList.add("is-open")}),k.querySelectorAll("[data-doc-action]").forEach(e=>{e.addEventListener("click",o=>{let t;o.preventDefault(),o.stopPropagation(),L();let i=e.dataset.docAction,n=a.querySelector(".btn-upload");("view"===i||"download"===i)&&n?.click(),("review"===i||"pending"===i)&&((t=a.querySelector(".analyst-review"))?(t.hidden=!1,t.scrollIntoView({block:"nearest",behavior:"smooth"})):A("Documento indisponivel","A an\xe1lise fica dispon\xedvel quando houver upload recebido.",3600)),"delete"===i&&A("A\xe7\xe3o indispon\xedvel","Exclus\xe3o individual de documento n\xe3o existe nas regras atuais.",3600)})}),l.classList.add("document-table-cell","doc-documents-cell"),a.querySelector("[data-creditu-input]")||y.appendChild(k),y.appendChild(l),l.querySelector(".btn-upload")?.replaceChildren(document.createTextNode("Documentos")),s.innerHTML="",s.append(r,g,b,h,x,w,y);let S=a.querySelector("[data-creditu-input]");S?.dataset.credituInput&&E(S.dataset.credituInput,S.value),a.title=p,i.appendChild(a)})}),document.addEventListener("click",L)),g&&(e.style.visibility="visible"),e.querySelectorAll("[data-kit-caixa-download]").forEach(e=>{"true"!==e.dataset.workflowWired&&(e.dataset.workflowWired="true",e.addEventListener("click",async e=>{if(e.preventDefault(),e.stopPropagation(),!o)return void A("Download indispon\xedvel","Reserva n\xe3o informada para download.",4200);try{let e=await fetch(`/api/processos/${encodeURIComponent(o)}/kit-caixa/download`,{cache:"no-store"});if(!e.ok){let a=(e.headers.get("Content-Type")||"").includes("application/json")?(await e.json().catch(()=>({}))).detail:await e.text().catch(()=>"");A("Download indispon\xedvel",a||"N\xe3o existem documentos do Kit Caixa dispon\xedveis para download.",4200);return}let a=await e.blob(),t=URL.createObjectURL(a),i=document.createElement("a"),n=(e.headers.get("Content-Disposition")||"").match(/filename="?([^"]+)"?/i);i.href=t,i.download=n?.[1]||`KIT_CAIXA_RESERVA_${o}.pdf`,document.body.appendChild(i),i.click(),i.remove(),URL.revokeObjectURL(t)}catch(e){A("Download indispon\xedvel",e instanceof Error?e.message:"N\xe3o existem documentos do Kit Caixa dispon\xedveis para download.",4200)}}))}),e.querySelectorAll("[data-kit-agehab-download]").forEach(e=>{"true"!==e.dataset.workflowWired&&(e.dataset.workflowWired="true",e.addEventListener("click",async e=>{if(e.preventDefault(),e.stopPropagation(),!o)return void A("Download indispon\xedvel","Reserva n\xe3o informada para download.",4200);try{let e=await fetch(`/api/processos/${encodeURIComponent(o)}/kit-agehab/download`,{cache:"no-store"});if(!e.ok){let a=(e.headers.get("Content-Type")||"").includes("application/json")?(await e.json().catch(()=>({}))).detail:await e.text().catch(()=>"");A("Download indispon\xedvel",a||"N\xe3o existem documentos do Kit AGEHAB dispon\xedveis para download.",4200);return}let a=await e.blob(),t=URL.createObjectURL(a),i=document.createElement("a"),n=(e.headers.get("Content-Disposition")||"").match(/filename="?([^"]+)"?/i);i.href=t,i.download=n?.[1]||`KIT_AGEHAB_RESERVA_${o}.pdf`,document.body.appendChild(i),i.click(),i.remove(),URL.revokeObjectURL(t)}catch(e){A("Download indispon\xedvel",e instanceof Error?e.message:"N\xe3o existem documentos do Kit AGEHAB dispon\xedveis para download.",4200)}}))}),e.querySelectorAll("[data-creditu-download]").forEach(e=>{"true"!==e.dataset.workflowWired&&(e.dataset.workflowWired="true",e.addEventListener("click",async e=>{if(e.preventDefault(),e.stopPropagation(),o)try{let e=await fetch(`/api/processos/${encodeURIComponent(o)}/creditu/download`,{cache:"no-store"});if(!e.ok){let a=(e.headers.get("Content-Type")||"").includes("application/json")?(await e.json().catch(()=>({}))).detail:await e.text().catch(()=>"");A("Download indispon\xedvel",a||"N\xe3o existem documentos dispon\xedveis para download.",4200);return}let a=await e.blob(),t=URL.createObjectURL(a),i=document.createElement("a"),n=(e.headers.get("Content-Disposition")||"").match(/filename="?([^"]+)"?/i);i.href=t,i.download=n?.[1]||`CREDITU_RESERVA_${o}.pdf`,document.body.appendChild(i),i.click(),i.remove(),URL.revokeObjectURL(t)}catch(e){A("Download indispon\xedvel",e instanceof Error?e.message:"N\xe3o existem documentos dispon\xedveis para download.",4200)}}))}),e.querySelectorAll("[data-creditu-save]").forEach(a=>{"true"!==a.dataset.workflowWired&&(a.dataset.workflowWired="true",a.addEventListener("click",async t=>{t.preventDefault(),t.stopPropagation();let i=a.dataset.credituSave||"",n=e.querySelector(`[data-creditu-input="${CSS.escape(i)}"]`);if(o&&i&&n)try{let e="documentos-creditu-email-segundo-proponente-4"===i?{email_segundo_proponente:n.value.trim()}:{telefone_segundo_proponente:n.value.trim()},a=await fetch(`/api/processos/${encodeURIComponent(o)}/creditu`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!a.ok){let e=await a.json().catch(()=>({}));throw Error(e.detail||e.error||`Nao foi possivel salvar (${a.status}).`)}E(i,n.value),A("Dados salvos","Informacao salva no processo.")}catch(e){A("Erro",e instanceof Error?e.message:"Nao foi possivel salvar.",3600)}}))}),f(),w.canUpload&&e.querySelectorAll("input[data-doc-input]").forEach(X),ee(),window.addEventListener("focus",ee),window.addEventListener("maq2-workflow-updated",Z),()=>{window.clearTimeout(l),ea?.removeEventListener("change",eu),ei?.removeEventListener("change",ef),er?.removeEventListener("change",em),ec?.removeEventListener("change",ev),ep?.removeEventListener("change",eg),en?.removeEventListener("click",eb),ed?.removeEventListener("click",eh),es?.removeEventListener("click",J),document.removeEventListener("click",L),window.removeEventListener("focus",ee),window.removeEventListener("maq2-workflow-updated",Z)}},[y,h,w,x]),(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("style",{children:`@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
${d}`}),(0,t.jsx)("div",{ref:b,style:g?{visibility:"hidden"}:void 0,dangerouslySetInnerHTML:{__html:k}})]})}},1601:(e,a,o)=>{Promise.resolve().then(o.bind(o,1221))}}]);