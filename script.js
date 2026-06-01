// ====== CONFIGURAÇÃO E CONEXÃO COM O BANCO DE DADOS (SUPABASE) ======
// A URL abaixo usa o ID gerado automaticamente a partir da sua chave pública fornecida
const SUPABASE_URL = "https://cnatk9qzp-svvkdtdtir.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_CNatk9qZp-SvvkDTdTIRqQ_loozljJD"; 

// Inicializa o cliente oficial do Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variáveis de Controle de Estado da Aplicação
let currentUser = sessionStorage.getItem('logged_user') || null;
let currentUserObj = null; 
let currentActiveModule = null;
let transactions = [];
let stockItems = []; 
let editingUserFromSearch = null; // Armazena temporariamente o usuário que o admin está editando

// Seleção de Telas Principais do DOM
const screenLogin = document.getElementById('login-screen');
const screenRegister = document.getElementById('register-screen');
const screenForcePassword = document.getElementById('force-password-screen');
const screenMenu = document.getElementById('menu-screen');
const screenFinancas = document.getElementById('system-dashboard');
const screenAdmin = document.getElementById('admin-panel');
const screenAlmoxarifado = document.getElementById('system-almoxarifado'); 

// Elementos do Módulo de Login e Registro
const usernameInput = document.getElementById('login-username');
const passwordInput = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');
const linkGoRegister = document.getElementById('link-go-register');
const linkBackLogin = document.getElementById('link-back-login');

const regUsernameInput = document.getElementById('reg-username');
const regEmailInput = document.getElementById('reg-email');
const regReqFinancas = document.getElementById('reg-req-financas');
const regReqAlmoxarifado = document.getElementById('reg-req-almoxarifado');
const regReqManutencao = document.getElementById('reg-req-manutencao');
const btnSendRequest = document.getElementById('btn-send-request');

// Elementos do Módulo Finanças
const totalBalance = document.getElementById('total-balance');
const totalEntries = document.getElementById('total-entries');
const totalExpenses = document.getElementById('total-expenses');
const transTitleInput = document.getElementById('trans-title');
const transValueInput = document.getElementById('trans-value');
const transTypeSelect = document.getElementById('trans-type');
const btnSaveTransaction = document.getElementById('btn-save');
const btnClearFinancas = document.getElementById('btn-clear');
const listContainer = document.getElementById('list-container');

// Elementos do Módulo Almoxarifado
const prodNameInput = document.getElementById('stock-prod-name');
const prodQtyInput = document.getElementById('stock-prod-qty');
const prodMinInput = document.getElementById('stock-prod-min');
const prodCostInput = document.getElementById('stock-prod-cost');
const btnSaveProduct = document.getElementById('btn-save-product');
const stockTableBody = document.getElementById('stock-table-body');
const stockSearchInput = document.getElementById('stock-search');
const stockFilterSelect = document.getElementById('stock-filter');
const auditLogContainer = document.getElementById('stock-audit-log');

// Elementos do Painel Admin
const adminRequestsContainer = document.getElementById('admin-requests-container');
const adminSearchUser = document.getElementById('admin-search-user');
const btnSearchUser = document.getElementById('btn-search-user');
const adminUserPermissionsCard = document.getElementById('admin-user-permissions-card');
const editingUserTitle = document.getElementById('editing-user-title');
const permFinancasCheckbox = document.getElementById('perm-financas');
const permAlmoxarifadoCheckbox = document.getElementById('perm-almoxarifado');
const permManutencaoCheckbox = document.getElementById('perm-manutencao');
const btnSavePermissions = document.getElementById('btn-save-permissions');

// Elementos de Troca de Senha Obrigatória
const forceNewPasswordInput = document.getElementById('force-new-password');
const forceConfirmPasswordInput = document.getElementById('force-confirm-password');
const btnChangePasswordSubmit = document.getElementById('btn-change-password-submit');


// ================= SESSÃO E AUTENTICAÇÃO NO SUPABASE =================
async function handleLogin() {
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!username || !password) {
        loginError.innerText = "SISTEMA: Digite o usuário e a senha.";
        return;
    }

    const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .single();

    if (error || !user) {
        loginError.innerText = "ACESSO NEGADO: Usuário não localizado.";
        return;
    }

    if (user.password !== password) {
        loginError.innerText = "ACESSO NEGADO: Senha inválida.";
        return;
    }

    if (user.is_blocked) {
        loginError.innerText = "SISTEMA: Conta suspensa pelo administrador.";
        return;
    }

    // Se o usuário foi criado por solicitação e está no primeiro acesso
    if (user.is_temporary) {
        currentUser = user.username;
        showScreen(screenForcePassword);
        return;
    }

    logInUserSession(user);
}

function logInUserSession(user) {
    currentUser = user.username;
    currentUserObj = user;
    sessionStorage.setItem('logged_user', user.username);
    
    loginError.innerText = "";
    usernameInput.value = "";
    passwordInput.value = "";
    
    showScreen(screenMenu);
    renderMenu();
}

function handleLogout() {
    currentUser = null;
    currentUserObj = null;
    sessionStorage.removeItem('logged_user');
    currentActiveModule = null;
    showScreen(screenLogin);
}

async function checkActiveSession() {
    if (currentUser) {
        const { data: user } = await supabase.from('usuarios').select('*').eq('username', currentUser).single();
        if (user && !user.is_blocked) {
            currentUserObj = user;
            showScreen(screenMenu);
            renderMenu();
            return;
        }
    }
    showScreen(screenLogin);
}

function showScreen(screenTarget) {
    [screenLogin, screenRegister, screenForcePassword, screenMenu, screenFinancas, screenAdmin, screenAlmoxarifado].forEach(s => {
        if(s) s.classList.add('hidden');
    });
    if(screenTarget) screenTarget.classList.remove('hidden');
}

function updateHeaderUsernames() {
    if (!currentUserObj) return;
    document.querySelectorAll('.user-placeholder-name').forEach(el => {
        el.innerText = currentUserObj.display_name;
    });
}

function renderMenu() {
    updateHeaderUsernames();
    const cardAdmin = document.getElementById('mod-admin');
    
    if (currentUserObj?.is_admin) {
        cardAdmin.classList.remove('hidden');
    } else {
        cardAdmin.classList.add('hidden');
    }

    document.querySelectorAll('.module-card:not(.disabled):not(.admin-only)').forEach(card => {
        const moduleName = card.getAttribute('data-module');
        let hasAccess = false;

        if (moduleName === 'financas') hasAccess = currentUserObj?.perm_financas;
        if (moduleName === 'almoxarifado') hasAccess = currentUserObj?.perm_almoxarifado;
        if (moduleName === 'manutencao') hasAccess = currentUserObj?.perm_manutencao;

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


// ================= SOLICITAÇÃO DE ACESSOS (REGISTRO) =================
if (btnSendRequest) {
    btnSendRequest.addEventListener('click', async () => {
        const username = regUsernameInput.value.trim().toLowerCase();
        const email = regEmailInput.value.trim();

        if (!username || !email) {
            alert("Preencha todos os campos obrigatórios.");
            return;
        }

        // Envia o pedido para uma tabela temporária de requisições ou trata como usuário bloqueado até aprovação
        // Para simplificar a estrutura com as 3 tabelas unificadas, salvamos as solicitações como contas bloqueadas
        const { error } = await supabase
            .from('usuarios')
            .insert([{ 
                username, 
                password: "123", // Senha padrão inicial de primeiro acesso
                display_name: username.toUpperCase(), 
                email,
                is_admin: false,
                is_temporary: true,
                is_blocked: true, // Começa bloqueado até o administrador aprovar no painel
                perm_financas: regReqFinancas.checked,
                perm_almoxarifado: regReqAlmoxarifado.checked,
                perm_manutencao: regReqManutencao.checked
            }]);

        if (error) {
            alert("Erro ao enviar solicitação: Usuário ou e-mail já existente.");
        } else {
            alert("Solicitação enviada com sucesso! Aguarde a liberação do administrador.");
            regUsernameInput.value = ""; regEmailInput.value = "";
            regReqFinancas.checked = false; regReqAlmoxarifado.checked = false; regReqManutencao.checked = false;
            showScreen(screenLogin);
        }
    });
}

if (btnChangePasswordSubmit) {
    btnChangePasswordSubmit.addEventListener('click', async () => {
        const newPass = forceNewPasswordInput.value;
        const confirmPass = forceConfirmPasswordInput.value;

        if (!newPass || newPass !== confirmPass) {
            alert("As senhas não coincidem ou estão vazias.");
            return;
        }

        const { data, error } = await supabase
            .from('usuarios')
            .update({ password: newPass, is_temporary: false, is_blocked: false })
            .eq('username', currentUser)
            .select()
            .single();

        if (!error && data) {
            alert("Senha atualizada com sucesso!");
            forceNewPasswordInput.value = ""; forceConfirmPasswordInput.value = "";
            logInUserSession(data);
        } else {
            alert("Erro ao atualizar senha.");
        }
    });
}


// ================= PAINEL ADMINISTRATIVO (GERENCIAMENTO DE ACESSOS) =================
async function loadAdminPanelData() {
    // Busca contas suspensas que possuem marcação de primeiro acesso (Solicitações pendentes)
    const { data: pendentes, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('is_blocked', true)
        .eq('is_temporary', true);

    if (!error && adminRequestsContainer) {
        adminRequestsContainer.innerHTML = "";
        if (pendentes.length === 0) {
            adminRequestsContainer.innerHTML = `<p style="color:var(--text-secondary); font-size:13px; padding:10px;">Nenhuma solicitação de acesso pendente no momento.</p>`;
        } else {
            pendentes.forEach(req => {
                const card = document.createElement('div');
                card.className = "request-card";
                card.style.cssText = "background:#1f2230; padding:15px; border-radius:6px; margin-bottom:12px; border:1px solid var(--border-color);";
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #2d3748; padding-bottom:8px; font-size:13px; margin-bottom:10px;">
                        <span><strong>USUÁRIO:</strong> ${req.username}</span>
                        <span><strong>EMAIL:</strong> ${req.email}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;">
                        Módulos pedidos: 
                        ${req.perm_financas ? '[Finanças] ' : ''} 
                        ${req.perm_almoxarifado ? '[Almoxarifado] ' : ''} 
                        ${req.perm_manutencao ? '[Manutenção]' : ''}
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-approve" onclick="approveUser('${req.username}')" style="background:#2ecc71; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">APROVAR</button>
                        <button class="btn-deny" onclick="denyUser('${req.username}')" style="background:#e74c3c; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">REJEITAR</button>
                    </div>
                `;
                adminRequestsContainer.appendChild(card);
            });
        }
    }
}

window.approveUser = async function(username) {
    const { error } = await supabase
        .from('usuarios')
        .update({ is_blocked: false }) // Desbloqueia a conta para permitir o acesso
        .eq('username', username);

    if (!error) {
        alert(`Conta de ${username.toUpperCase()} aprovada com sucesso!`);
        loadAdminPanelData();
    }
};

window.denyUser = async function(username) {
    if (confirm(`Deseja recusar e deletar permanentemente a solicitação de ${username.toUpperCase()}?`)) {
        const { error } = await supabase.from('usuarios').delete().eq('username', username);
        if (!error) {
            loadAdminPanelData();
        }
    }
};

if (btnSearchUser) {
    btnSearchUser.addEventListener('click', async () => {
        const search = adminSearchUser.value.trim().toLowerCase();
        if (!search) return;

        const { data: user, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('username', search)
            .single();

        if (error || !user) {
            alert("Usuário não encontrado.");
            adminUserPermissionsCard.classList.add('hidden');
            return;
        }

        editingUserFromSearch = user.username;
        editingUserTitle.innerText = `Editando: ${user.display_name} (${user.username})`;
        permFinancasCheckbox.checked = user.perm_financas;
        permAlmoxarifadoCheckbox.checked = user.perm_almoxarifado;
        permManutencaoCheckbox.checked = user.perm_manutencao;
        adminUserPermissionsCard.classList.remove('hidden');
    });
}

if (btnSavePermissions) {
    btnSavePermissions.addEventListener('click', async () => {
        if (!editingUserFromSearch) return;

        const { error } = await supabase
            .from('usuarios')
            .update({
                perm_financas: permFinancasCheckbox.checked,
                perm_almoxarifado: permAlmoxarifadoCheckbox.checked,
                perm_manutencao: permManutencaoCheckbox.checked
            })
            .eq('username', editingUserFromSearch);

        if (!error) {
            alert("Permissões salvas e sincronizadas com sucesso no banco!");
            adminUserPermissionsCard.classList.add('hidden');
            adminSearchUser.value = "";
        } else {
            alert("Erro ao salvar permissões.");
        }
    });
}


// ================= MÓDULO FINANÇAS =================
async function loadFinancasData() {
    const { data, error } = await supabase
        .from('financas')
        .select('*')
        .order('created_at', { ascending: false });

    transactions = error ? [] : data;
    renderFinancas();
}

function renderFinancas() {
    if (!listContainer) return;
    listContainer.innerHTML = "";
    let ent = 0, sai = 0;

    transactions.forEach((t) => {
        const item = document.createElement('div');
        item.style.cssText = "padding:10px; border-bottom:1px solid #2d3748; display:flex; justify-content:space-between; font-size:13px;";
        const valNumeric = parseFloat(t.value) || 0;

        if (t.type === 'entrada') {
            ent += valNumeric;
            item.innerHTML = `<span>${t.title}</span> <span style="color:var(--color-success)">+ R$ ${valNumeric.toFixed(2)}</span>`;
        } else {
            sai += valNumeric;
            item.innerHTML = `<span>${t.title}</span> <span style="color:var(--color-danger)">- R$ ${valNumeric.toFixed(2)}</span>`;
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
    btnSaveTransaction.addEventListener('click', async () => {
        const title = transTitleInput.value.trim();
        const value = parseFloat(transValueInput.value);
        const type = transTypeSelect.value;
        if (!title || isNaN(value)) return;

        const { error } = await supabase
            .from('financas')
            .insert([{ title, value, type, created_by: currentUser }]);

        if (!error) {
            transTitleInput.value = ''; transValueInput.value = '';
            await loadFinancasData();
        }
    });
}

if (btnClearFinancas) {
    btnClearFinancas.addEventListener('click', async () => {
        if (confirm("Deseja mesmo limpar todo o histórico de transações do SQL?")) {
            const { error } = await supabase.from('financas').delete().neq('id', 0); // Limpa todas as linhas
            if (!error) {
                await loadFinancasData();
            }
        }
    });
}


// ================= MÓDULO ALMOXARIFADO AVANÇADO =================
async function loadAlmoxarifadoData() {
    const resProdutos = await supabase.from('almoxarifado').select('*').order('name', { ascending: true });
    const resLogs = await supabase.from('almoxarifado_logs').select('*').order('created_at', { ascending: false }).limit(25);
    
    stockItems = resProdutos.error ? [] : resProdutos.data;
    
    renderStockTable();
    renderStockKPIs();
    renderAuditLogs(resLogs.error ? [] : resLogs.data);
}

async function addLog(action, message) {
    const operatorName = currentUserObj?.display_name || "SISTEMA";
    await supabase.from('almoxarifado_logs').insert([{ action, message, operator: operatorName }]);
}

function renderStockKPIs() {
    let totalItems = stockItems.length;
    let valuation = stockItems.reduce((acc, curr) => {
        const itemQty = parseInt(curr.qty) || 0;
        const itemCost = parseFloat(curr.cost) || 0;
        return acc + (itemQty * itemCost);
    }, 0);

    let alerts = stockItems.filter(item => (parseInt(item.qty) || 0) <= (parseInt(item.min_qty) || 0)).length;

    const kpiTotalItems = document.getElementById('kpi-total-items');
    const kpiTotalValuation = document.getElementById('kpi-total-valuation');
    const kpiCriticalAlerts = document.getElementById('kpi-critical-alerts');

    if (kpiTotalItems) kpiTotalItems.innerText = totalItems;
    if (kpiTotalValuation) kpiTotalValuation.innerText = `R$ ${valuation.toFixed(2)}`;
    if (kpiCriticalAlerts) kpiCriticalAlerts.innerText = alerts;
}

function renderAuditLogs(logsArray) {
    if(!auditLogContainer) return;
    auditLogContainer.innerHTML = "";
    
    if(logsArray.length === 0) {
        auditLogContainer.innerHTML = `<span style="color:var(--text-secondary)">Sem movimentações recentes.</span>`;
        return;
    }

    logsArray.forEach(log => {
        const row = document.createElement('div');
        row.style.cssText = "background: #1c1e2a; padding: 6px 10px; border-radius:4px; border-left: 2px solid #6c5ce7; margin-bottom:4px;";
        const timeFormatted = new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        row.innerHTML = `<strong>[${timeFormatted}] ${log.operator}:</strong> ${log.message}`;
        auditLogContainer.appendChild(row);
    });
}

function renderStockTable() {
    if (!stockTableBody) return;
    stockTableBody.innerHTML = "";

    const searchTerm = stockSearchInput ? stockSearchInput.value.toLowerCase() : "";
    const filterType = stockFilterSelect ? stockFilterSelect.value : "all";

    const filteredItems = stockItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm);
        const q = parseInt(item.qty) || 0;
        const m = parseInt(item.min_qty) || 0;

        if (filterType === 'critical') return matchesSearch && (q <= m);
        if (filterType === 'zero') return matchesSearch && (q === 0);
        return matchesSearch;
    });

    if (filteredItems.length === 0) {
        stockTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); padding:20px;">Nenhum material localizado nos filtros.</td></tr>`;
        return;
    }

    filteredItems.forEach((item) => {
        const tr = document.createElement('tr');
        const q = parseInt(item.qty) || 0;
        const m = parseInt(item.min_qty) || 0;
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
                <button class="btn-stock-action" onclick="changeStockQty(${item.id}, 1)" title="Entrada"><i class="fas fa-plus"></i></button>
                <button class="btn-stock-action" onclick="changeStockQty(${item.id}, -1)" title="Baixa"><i class="fas fa-minus"></i></button>
                <button class="btn-stock-action btn-stock-danger" style="background:#451a1a;" onclick="deleteStockItem(${item.id}, '${item.name}')" title="Remover"><i class="fas fa-trash"></i></button>
            </td>
        `;
        stockTableBody.appendChild(tr);
    });
}

if (btnSaveProduct) {
    btnSaveProduct.addEventListener('click', async () => {
        const name = prodNameInput.value.trim();
        const qty = parseInt(prodQtyInput.value);
        const minQty = parseInt(prodMinInput.value);
        const cost = parseFloat(prodCostInput.value);

        if (!name || isNaN(qty) || qty < 0 || isNaN(minQty) || minQty < 0 || isNaN(cost) || cost < 0) {
            alert('Por favor, insira valores válidos.');
            return;
        }

        const { error } = await supabase
            .from('almoxarifado')
            .insert([{ name, qty, min_qty: minQty, cost }]);

        if (error) {
            alert('ERRO: Material já registrado ou falha de rede.');
        } else {
            await addLog("cadastro", `Cadastrou o produto "${name.toUpperCase()}" com estoque de ${qty} Un.`);
            prodNameInput.value = ''; prodQtyInput.value = ''; prodMinInput.value = ''; prodCostInput.value = '';
            await loadAlmoxarifadoData();
        }
    });
}

window.changeStockQty = async function(id, amount) {
    const item = stockItems.find(i => i.id === id);
    if (!item) return;

    let currentQty = parseInt(item.qty) || 0;
    if (amount < 0 && currentQty + amount < 0) {
        alert('ERRO OPERACIONAL: Saldo em estoque insuficiente.');
        return;
    }

    const newQty = currentQty + amount;

    const { error } = await supabase
        .from('almoxarifado')
        .update({ qty: newQty })
        .eq('id', id);

    if (!error) {
        const actionType = amount > 0 ? "Entrada" : "Saída/Baixa";
        await addLog("movimentacao", `${actionType} de 1 unidade efetuada para o item "${item.name.toUpperCase()}". Novo saldo: ${newQty}.`);
        await loadAlmoxarifadoData();
    }
};

window.deleteStockItem = async function(id, name) {
    if (confirm(`Remover "${name.toUpperCase()}" permanentemente do SQL?`)) {
        const { error } = await supabase.from('almoxarifado').delete().eq('id', id);
        if (!error) {
            await addLog("remocao", `Removeu o item "${name.toUpperCase()}" do almoxarifado.`);
            await loadAlmoxarifadoData();
        }
    }
};


// ================= CONFIGURAÇÃO DE GATILHOS DE TELAS E CLIQUES =================
document.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        const moduleName = card.getAttribute('data-module');

        if (moduleName === 'admin' && currentUserObj?.is_admin) {
            showScreen(screenAdmin);
            loadAdminPanelData();
            return;
        }

        if (moduleName === 'financas' && currentUserObj?.perm_financas) {
            currentActiveModule = 'financas';
            showScreen(screenFinancas);
            loadFinancasData();
        } else if (moduleName === 'almoxarifado' && currentUserObj?.perm_almoxarifado) {
            currentActiveModule = 'almoxarifado';
            showScreen(screenAlmoxarifado);
            loadAlmoxarifadoData();
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

if (linkGoRegister) linkGoRegister.addEventListener('click', () => showScreen(screenRegister));
if (linkBackLogin) linkBackLogin.addEventListener('click', () => showScreen(screenLogin));
document.querySelectorAll('.btn-trigger-logout').forEach(btn => btn.addEventListener('click', handleLogout));
if (btnLogin) btnLogin.addEventListener('click', handleLogin);

if (stockSearchInput) stockSearchInput.addEventListener('input', renderStockTable);
if (stockFilterSelect) stockFilterSelect.addEventListener('change', renderStockTable);

passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });

// Inicialização de estado ao abrir a página
checkActiveSession();