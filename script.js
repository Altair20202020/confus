// --- DATABASE DE USUÁRIOS E PERMISSÕES (Simulação LocalStorage) ---
const INITIAL_USERS = {
    "altair": { password: "123", displayName: "ALTAIR_ADMIN", isAdmin: true, isTemporary: false, isBlocked: false, email: "altair@empresa.com", permissions: { financas: true, almoxarifado: true, manutencao: true } },
    "meli": { password: "456", displayName: "MELI_USER", isAdmin: false, isTemporary: false, isBlocked: false, email: "meli@empresa.com", permissions: { financas: true, almoxarifado: false, manutencao: false } }
};

// Inicialização dos Bancos de Dados no LocalStorage
if (!localStorage.getItem('sys_users_db')) {
    localStorage.setItem('sys_users_db', JSON.stringify(INITIAL_USERS));
}
if (!localStorage.getItem('sys_requests_db')) {
    localStorage.setItem('sys_requests_db', JSON.stringify([]));
}

let usersDB = JSON.parse(localStorage.getItem('sys_users_db'));
let requestsDB = JSON.parse(localStorage.getItem('sys_requests_db'));
let currentUser = sessionStorage.getItem('logged_user') || null;
let currentActiveModule = null;
let transactions = [];
let stockItems = []; 
let stockLogs = [];
let userPendingPasswordForce = null; 

// Seleção de Telas Principais
const screenLogin = document.getElementById('login-screen');
const screenRegister = document.getElementById('register-screen');
const screenForcePassword = document.getElementById('force-password-screen');
const screenMenu = document.getElementById('menu-screen');
const screenFinancas = document.getElementById('system-dashboard');
const screenAdmin = document.getElementById('admin-panel');
const screenAlmoxarifado = document.getElementById('system-almoxarifado'); 

// Elementos de Login
const usernameInput = document.getElementById('login-username');
const passwordInput = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');

// Elementos de Administração de Permissões
const searchUserInput = document.getElementById('admin-search-user');
const btnSearchUser = document.getElementById('btn-search-user');
const permissionsCard = document.getElementById('admin-user-permissions-card');
const editingUserTitle = document.getElementById('editing-user-title');
const chkFinancas = document.getElementById('perm-financas');
const chkAlmoxarifado = document.getElementById('perm-almoxarifado');
const chkManutencao = document.getElementById('perm-manutencao');
const btnSavePermissions = document.getElementById('btn-save-permissions');
let userBeingEdited = null;

// Elementos do Módulo Finanças
const totalBalance = document.getElementById('total-balance');
const totalEntries = document.getElementById('total-entries');
const totalExpenses = document.getElementById('total-expenses');
const transTitleInput = document.getElementById('trans-title');
const transValueInput = document.getElementById('trans-value');
const transTypeSelect = document.getElementById('trans-type');
const btnSaveTransaction = document.getElementById('btn-save');
const btnClearTransactions = document.getElementById('btn-clear');
const listContainer = document.getElementById('list-container');

// Elementos do Módulo Almoxarifado Avançado
const prodNameInput = document.getElementById('stock-prod-name');
const prodQtyInput = document.getElementById('stock-prod-qty');
const prodMinInput = document.getElementById('stock-prod-min');
const prodCostInput = document.getElementById('stock-prod-cost');
const btnSaveProduct = document.getElementById('btn-save-product');
const stockTableBody = document.getElementById('stock-table-body');
const stockSearchInput = document.getElementById('stock-search');
const stockFilterSelect = document.getElementById('stock-filter');
const auditLogContainer = document.getElementById('stock-audit-log');


// ================= CORE DE SESSÃO E LOGIN =================
function handleLogin() {
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (usersDB[username] && usersDB[username].password === password) {
        if (usersDB[username].isBlocked) {
            loginError.innerText = "SISTEMA: ESTA CONTA FOI SUSPENSA PELO ADMINISTRADOR.";
            return;
        }
        if (usersDB[username].isTemporary) {
            userPendingPasswordForce = username;
            showScreen(screenForcePassword);
            return;
        }

        currentUser = username;
        sessionStorage.setItem('logged_user', username);
        loginError.innerText = "";
        usernameInput.value = "";
        passwordInput.value = "";
        showScreen(screenMenu);
        renderMenu();
    } else {
        loginError.innerText = "ACESSO NEGADO: CREDENCIAIS INVÁLIDAS";
    }
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('logged_user');
    currentActiveModule = null;
    showScreen(screenLogin);
}

function showScreen(screenTarget) {
    [screenLogin, screenRegister, screenForcePassword, screenMenu, screenFinancas, screenAdmin, screenAlmoxarifado].forEach(s => {
        if(s) s.classList.add('hidden');
    });
    if(screenTarget) screenTarget.classList.remove('hidden');
}

function updateHeaderUsernames() {
    if (!currentUser) return;
    document.querySelectorAll('.user-placeholder-name').forEach(el => {
        el.innerText = usersDB[currentUser].displayName;
    });
}

function renderMenu() {
    updateHeaderUsernames();
    const userObj = usersDB[currentUser];
    const cardAdmin = document.getElementById('mod-admin');
    
    if (userObj.isAdmin) {
        cardAdmin.classList.remove('hidden');
    } else {
        cardAdmin.classList.add('hidden');
    }

    document.querySelectorAll('.module-card:not(.disabled):not(.admin-only)').forEach(card => {
        const moduleName = card.getAttribute('data-module');
        const hasAccess = userObj.permissions[moduleName];
        const badge = card.querySelector('.badge-permission');

        if (badge) {
            if (hasAccess) {
                card.style.opacity = "1";
                badge.innerText = "ACESSO_LIBERADO";
                badge.style.color = "var(--color-success)";
                badge.style.borderColor = "var(--color-success)";
            } else {
                card.style.opacity = "0.6";
                badge.innerText = "BLOQUEADO_PELO_ADMIN";
                badge.style.color = "var(--color-danger)";
                badge.style.borderColor = "var(--color-danger)";
            }
        }
    });
}

document.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        const moduleName = card.getAttribute('data-module');
        const userObj = usersDB[currentUser];

        if (moduleName === 'admin' && userObj.isAdmin) {
            showScreen(screenAdmin);
            renderAdminRequests();
            injectAdminActionButtons();
            return;
        }

        if (userObj.permissions[moduleName]) {
            if (moduleName === 'financas') {
                currentActiveModule = 'financas';
                showScreen(screenFinancas);
                loadFinancasData();
            } else if (moduleName === 'almoxarifado') {
                currentActiveModule = 'almoxarifado';
                showScreen(screenAlmoxarifado);
                loadAlmoxarifadoData();
            }
        } else {
            alert("ERRO_DE_SEGURANÇA: Você não possui diretivas de acesso. Contate o Administrador.");
        }
    });
});

document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
        currentActiveModule = null;
        showScreen(screenMenu);
        renderMenu();
    });
});

document.querySelectorAll('.btn-trigger-logout').forEach(btn => {
    btn.addEventListener('click', handleLogout);
});

if (btnLogin) btnLogin.addEventListener('click', handleLogin);


// ================= FLUXO DE SOLICITAÇÃO DE CADASTRO =================
const linkGoRegister = document.getElementById('link-go-register');
const linkBackLogin = document.getElementById('link-back-login');

if (linkGoRegister) linkGoRegister.addEventListener('click', (e) => { e.preventDefault(); showScreen(screenRegister); });
if (linkBackLogin) linkBackLogin.addEventListener('click', (e) => { e.preventDefault(); showScreen(screenLogin); });

const btnSendRequest = document.getElementById('btn-send-request');
if (btnSendRequest) {
    btnSendRequest.addEventListener('click', () => {
        const userReg = document.getElementById('reg-username').value.trim().toLowerCase();
        const emailReg = document.getElementById('reg-email').value.trim();
        const reqFin = document.getElementById('reg-req-financas').checked;
        const reqAlm = document.getElementById('reg-req-almoxarifado').checked;
        const reqMan = document.getElementById('reg-req-manutencao').checked;

        if (!userReg || !emailReg) {
            alert("SISTEMA: Preencha o nome de usuário e e-mail corporativo obrigatórios.");
            return;
        }
        if (usersDB[userReg]) {
            alert("SISTEMA: Identidade rejeitada. Este usuário já existe.");
            return;
        }

        requestsDB.push({
            username: userReg,
            email: emailReg,
            permissions: { financas: reqFin, almoxarifado: reqAlm, manutencao: reqMan }
        });
        localStorage.setItem('sys_requests_db', JSON.stringify(requestsDB));

        alert("SOLICITAÇÃO PROTOCOLADA!");
        showScreen(screenLogin);
    });
}

// Redefinição de Senha
const btnChangePasswordSubmit = document.getElementById('btn-change-password-submit');
if (btnChangePasswordSubmit) {
    btnChangePasswordSubmit.addEventListener('click', () => {
        const newPass = document.getElementById('force-new-password').value;
        const confPass = document.getElementById('force-confirm-password').value;

        if (!newPass || newPass !== confPass) { alert("SISTEMA: As senhas informadas não coincidem."); return; }

        usersDB[userPendingPasswordForce].password = newPass;
        usersDB[userPendingPasswordForce].isTemporary = false;
        localStorage.setItem('sys_users_db', JSON.stringify(usersDB));

        currentUser = userPendingPasswordForce;
        sessionStorage.setItem('logged_user', currentUser);
        userPendingPasswordForce = null;
        showScreen(screenMenu);
        renderMenu();
    });
}


// ================= SEÇÃO DE GERENCIAMENTO ADMIN =================
function renderAdminRequests() {
    const container = document.getElementById('admin-requests-container');
    if (!container) return;
    container.innerHTML = "";

    if (requestsDB.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); font-size:13px;">[PROVISIONAMENTO]: Nenhuma solicitação pendente.</p>`;
        return;
    }

    requestsDB.forEach((req, index) => {
        const card = document.createElement('div');
        card.classList.add('request-card');
        card.innerHTML = `
            <div class="request-card-header"><strong>Operador: ${req.username.toUpperCase()}</strong><span>${req.email}</span></div>
            <div class="request-actions">
                <button class="btn-approve" data-idx="${index}"><i class="fas fa-check"></i> Aprovar</button>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            const req = requestsDB[idx];
            usersDB[req.username] = {
                password: "123", 
                displayName: req.username.toUpperCase() + "_USER",
                isAdmin: false, isTemporary: false, isBlocked: false, email: req.email,
                permissions: { financas: req.permissions.financas, almoxarifado: req.permissions.almoxarifado, manutencao: req.permissions.manutencao }
            };
            localStorage.setItem('sys_users_db', JSON.stringify(usersDB));
            requestsDB.splice(idx, 1);
            localStorage.setItem('sys_requests_db', JSON.stringify(requestsDB));
            renderAdminRequests();
        });
    });
}

function injectAdminActionButtons() {
    if (document.getElementById('btn-admin-block-user')) return;
    const containerSave = document.getElementById('btn-save-permissions');
    if (!containerSave) return;

    const btnBlock = document.createElement('button');
    btnBlock.id = 'btn-admin-block-user';
    btnBlock.style.cssText = "background:#d35400; color:#fff; border:none; padding:10px; margin-top:10px; border-radius:4px; cursor:pointer; width:100%; font-weight:bold;";
    btnBlock.innerHTML = `<i class="fas fa-ban"></i> ALTERAR BLOQUEIO (ON/OFF)`;
    containerSave.parentNode.insertBefore(btnBlock, containerSave.nextSibling);

    btnBlock.addEventListener('click', () => {
        if (!userBeingEdited || userBeingEdited === 'altair') return;
        usersDB[userBeingEdited].isBlocked = !usersDB[userBeingEdited].isBlocked;
        localStorage.setItem('sys_users_db', JSON.stringify(usersDB));
        alert("Status do usuário modificado!");
    });
}

if (btnSearchUser) {
    btnSearchUser.addEventListener('click', () => {
        const query = searchUserInput.value.trim().toLowerCase();
        if (usersDB[query]) {
            userBeingEdited = query;
            editingUserTitle.innerText = `Editando: ${query.toUpperCase()}`;
            chkFinancas.checked = usersDB[query].permissions.financas;
            chkAlmoxarifado.checked = usersDB[query].permissions.almoxarifado;
            chkManutencao.checked = usersDB[query].permissions.manutencao;
            permissionsCard.classList.remove('hidden');
        } else {
            permissionsCard.classList.add('hidden');
        }
    });
}

if (btnSavePermissions) {
    btnSavePermissions.addEventListener('click', () => {
        if (!userBeingEdited) return;
        usersDB[userBeingEdited].permissions.financas = chkFinancas.checked;
        usersDB[userBeingEdited].permissions.almoxarifado = chkAlmoxarifado.checked;
        usersDB[userBeingEdited].permissions.manutencao = chkManutencao.checked;
        localStorage.setItem('sys_users_db', JSON.stringify(usersDB));
        alert("Permissões salvas!");
    });
}


// ================= MÓDULO FINANÇAS =================
function loadFinancasData() {
    const savedTrans = localStorage.getItem('sys_transactions');
    transactions = savedTrans ? JSON.parse(savedTrans) : [];
    renderFinancas();
}

function saveFinancasData() {
    localStorage.setItem('sys_transactions', JSON.stringify(transactions));
    renderFinancas();
}

function renderFinancas() {
    if (!listContainer) return;
    listContainer.innerHTML = "";
    let ent = 0, sai = 0;

    transactions.forEach((t) => {
        const item = document.createElement('div');
        item.style.cssText = "padding:10px; border-bottom:1px solid #2d3748; display:flex; justify-content:space-between; font-size:13px;";
        if (t.type === 'entrada') {
            ent += t.value;
            item.innerHTML = `<span>${t.title}</span> <span style="color:var(--color-success)">+ R$ ${t.value.toFixed(2)}</span>`;
        } else {
            sai += t.value;
            item.innerHTML = `<span>${t.title}</span> <span style="color:var(--color-danger)">- R$ ${t.value.toFixed(2)}</span>`;
        }
        listContainer.appendChild(item);
    });

    const bal = ent - sai;
    totalBalance.innerText = `R$ ${bal.toFixed(2)}`;
    totalEntries.innerText = `R$ ${ent.toFixed(2)}`;
    totalExpenses.innerText = `R$ ${sai.toFixed(2)}`;
    totalBalance.style.color = bal >= 0 ? "var(--color-success)" : "var(--color-danger)";
}

if (btnSaveTransaction) {
    btnSaveTransaction.addEventListener('click', () => {
        const title = transTitleInput.value.trim();
        const value = parseFloat(transValueInput.value);
        const type = transTypeSelect.value;
        if (!title || isNaN(value)) return;

        transactions.push({ title, value, type });
        transTitleInput.value = ''; transValueInput.value = '';
        saveFinancasData();
    });
}


// ================= MÓDULO ALMOXARIFADO AVANÇADO CORRIGIDO =================
function loadAlmoxarifadoData() {
    stockItems = JSON.parse(localStorage.getItem('sys_stock_items')) || [];
    stockLogs = JSON.parse(localStorage.getItem('sys_stock_logs')) || [];
    
    // Força os campos de filtro a iniciarem limpos para não sumir com a renderização inicial
    if (stockSearchInput) stockSearchInput.value = "";
    if (stockFilterSelect) stockFilterSelect.value = "all";

    renderStockTable();
    renderStockKPIs();
    renderAuditLogs();
}

function saveAlmoxarifadoData() {
    localStorage.setItem('sys_stock_items', JSON.stringify(stockItems));
    localStorage.setItem('sys_stock_logs', JSON.stringify(stockLogs));
    renderStockTable();
    renderStockKPIs();
    renderAuditLogs();
}

function addLog(action, message) {
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const operator = usersDB[currentUser]?.displayName || "SISTEMA";
    stockLogs.unshift({ time, operator, action, message });
    if(stockLogs.length > 30) stockLogs.pop();
}

function renderStockKPIs() {
    let totalItems = stockItems.length;
    
    // Redutor corrigido com parse numérico explícito para evitar problemas de string/soma zerada
    let valuation = stockItems.reduce((acc, curr) => {
        const itemQty = parseInt(curr.qty) || 0;
        const itemCost = parseFloat(curr.cost) || 0;
        return acc + (itemQty * itemCost);
    }, 0);

    let alerts = stockItems.filter(item => (parseInt(item.qty) || 0) <= (parseInt(item.minQty) || 0)).length;

    const kpiTotalItems = document.getElementById('kpi-total-items');
    const kpiTotalValuation = document.getElementById('kpi-total-valuation');
    const kpiCriticalAlerts = document.getElementById('kpi-critical-alerts');

    if (kpiTotalItems) kpiTotalItems.innerText = totalItems;
    if (kpiTotalValuation) kpiTotalValuation.innerText = `R$ ${valuation.toFixed(2)}`;
    if (kpiCriticalAlerts) kpiCriticalAlerts.innerText = alerts;
}

function renderAuditLogs() {
    if(!auditLogContainer) return;
    auditLogContainer.innerHTML = "";
    
    if(stockLogs.length === 0) {
        auditLogContainer.innerHTML = `<span style="color:var(--text-secondary)">Sem movimentações recentes.</span>`;
        return;
    }

    stockLogs.forEach(log => {
        const row = document.createElement('div');
        row.style.cssText = "background: #1c1e2a; padding: 6px 10px; border-radius:4px; border-left: 2px solid #6c5ce7; margin-bottom:4px;";
        row.innerHTML = `<strong>[${log.time}] ${log.operator}:</strong> ${log.message}`;
        auditLogContainer.appendChild(row);
    });
}

function renderStockTable() {
    if (!stockTableBody) return;
    stockTableBody.innerHTML = "";

    // Proteção de leitura de filtros vazios
    const searchTerm = stockSearchInput ? stockSearchInput.value.toLowerCase() : "";
    const filterType = stockFilterSelect ? stockFilterSelect.value : "all";

    const filteredItems = stockItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm);
        const q = parseInt(item.qty) || 0;
        const m = parseInt(item.minQty) || 0;

        if (filterType === 'critical') return matchesSearch && (q <= m);
        if (filterType === 'zero') return matchesSearch && (q === 0);
        return matchesSearch;
    });

    if (filteredItems.length === 0) {
        stockTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); padding:20px;">Nenhum material localizado nos filtros.</td></tr>`;
        return;
    }

    filteredItems.forEach((item) => {
        const originalIndex = stockItems.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
        
        const tr = document.createElement('tr');
        const q = parseInt(item.qty) || 0;
        const m = parseInt(item.minQty) || 0;
        const c = parseFloat(item.cost) || 0;
        
        if (q <= m) tr.classList.add('stock-row-critical');

        const totalCost = q * c;

        tr.innerHTML = `
            <td style="padding: 10px;"><strong>${item.name.toUpperCase()}</strong></td>
            <td style="padding: 10px; text-align: center;">${q} Un.</td>
            <td style="padding: 10px; text-align: center; color:#94a3b8;">${m} Un.</td>
            <td style="padding: 10px;">R$ ${c.toFixed(2)}</td>
            <td style="padding: 10px; font-weight:bold;">R$ ${totalCost.toFixed(2)}</td>
            <td style="padding: 10px; text-align: right;">
                <button class="btn-stock-action" onclick="changeStockQty(${originalIndex}, 1)" title="Entrada"><i class="fas fa-plus"></i></button>
                <button class="btn-stock-action" onclick="changeStockQty(${originalIndex}, -1)" title="Baixa"><i class="fas fa-minus"></i></button>
                <button class="btn-stock-action btn-stock-danger" style="background:#451a1a;" onclick="deleteStockItem(${originalIndex})" title="Remover"><i class="fas fa-trash"></i></button>
            </td>
        `;
        stockTableBody.appendChild(tr);
    });
}

if (btnSaveProduct) {
    btnSaveProduct.addEventListener('click', () => {
        const name = prodNameInput.value.trim();
        const qty = parseInt(prodQtyInput.value);
        const minQty = parseInt(prodMinInput.value);
        const cost = parseFloat(prodCostInput.value);

        // Validação estrita para impedir a entrada de strings incorretas e NaN
        if (!name || isNaN(qty) || qty < 0 || isNaN(minQty) || minQty < 0 || isNaN(cost) || cost < 0) {
            alert('Por favor, preencha todas as informações com valores numéricos válidos e maiores ou iguais a zero.');
            return;
        }

        if (stockItems.some(i => i.name.toLowerCase() === name.toLowerCase())) {
            alert('Este material já está registrado.');
            return;
        }

        stockItems.push({ name, qty, minQty, cost });
        addLog("cadastro", `Cadastrou o produto "${name.toUpperCase()}" com estoque inicial de ${qty} unidades.`);
        
        // Limpa as caixas de texto
        prodNameInput.value = ''; prodQtyInput.value = ''; prodMinInput.value = ''; prodCostInput.value = '';
        
        // Salva e atualiza
        saveAlmoxarifadoData();
    });
}

window.changeStockQty = function(index, amount) {
    const targetItem = stockItems[index];
    if (!targetItem) return;

    let currentQty = parseInt(targetItem.qty) || 0;
    if (amount < 0 && currentQty + amount < 0) {
        alert('ERRO OPERACIONAL: Saldo em estoque insuficiente.');
        return;
    }
    
    targetItem.qty = currentQty + amount;
    const tipoAcao = amount > 0 ? "Entrada" : "Saída/Baixa";
    addLog("movimentacao", `${tipoAcao} de 1 unidade efetuada para o item: "${targetItem.name.toUpperCase()}". Novo saldo: ${targetItem.qty}.`);
    saveAlmoxarifadoData();
};

window.deleteStockItem = function(index) {
    if (!stockItems[index]) return;
    if (confirm(`Remover "${stockItems[index].name.toUpperCase()}" permanentemente?`)) {
        addLog("remocao", `Removeu o item "${stockItems[index].name.toUpperCase()}" do almoxarifado.`);
        stockItems.splice(index, 1);
        saveAlmoxarifadoData();
    }
};

// Listeners dos Filtros Dinâmicos vinculados corretamente
if (stockSearchInput) stockSearchInput.addEventListener('input', renderStockTable);
if (stockFilterSelect) stockFilterSelect.addEventListener('change', renderStockTable);


// Inicializar aplicação caso usuário já esteja logado
if (currentUser && usersDB[currentUser]) {
    showScreen(screenMenu);
    renderMenu();
}