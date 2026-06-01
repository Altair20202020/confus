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
let stockItems = []; // Memória global do módulo almoxarifado
let userPendingPasswordForce = null; // Controla temporariamente o usuário em troca de senha obrigatória

// Seleção de Telas Principais
const screenLogin = document.getElementById('login-screen');
const screenRegister = document.getElementById('register-screen');
const screenForcePassword = document.getElementById('force-password-screen');
const screenMenu = document.getElementById('menu-screen');
const screenFinancas = document.getElementById('system-dashboard');
const screenAdmin = document.getElementById('admin-panel');
const screenAlmoxarifado = document.getElementById('system-almoxarifado'); // Nova Tela Vinculada

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

// Elementos do Módulo Almoxarifado
const prodNameInput = document.getElementById('stock-prod-name');
const prodQtyInput = document.getElementById('stock-prod-qty');
const prodMinInput = document.getElementById('stock-prod-min');
const btnSaveProduct = document.getElementById('btn-save-product');
const stockTableBody = document.getElementById('stock-table-body');


// ================= CORE DE SESSÃO E LOGIN =================
function handleLogin() {
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (usersDB[username] && usersDB[username].password === password) {
        
        // TRAVA DE SEGURANÇA: CONTA BLOQUEADA
        if (usersDB[username].isBlocked) {
            loginError.innerText = "SISTEMA: ESTA CONTA FOI SUSPENSA PELO ADMINISTRADOR.";
            return;
        }

        // REGRA DO PRIMEIRO ACESSO (Bloqueia login se a senha for temporária)
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

// Alternador de Telas Universal
function showScreen(screenTarget) {
    [screenLogin, screenRegister, screenForcePassword, screenMenu, screenFinancas, screenAdmin, screenAlmoxarifado].forEach(s => {
        if(s) s.classList.add('hidden');
    });
    if(screenTarget) screenTarget.classList.remove('hidden');
}

// Configurar elementos de texto comuns de usuário logado nas headers
function updateHeaderUsernames() {
    if (!currentUser) return;
    document.querySelectorAll('.user-placeholder-name').forEach(el => {
        el.innerText = usersDB[currentUser].displayName;
    });
}

// Renderiza o menu aplicando as travas de permissão
function renderMenu() {
    updateHeaderUsernames();
    const userObj = usersDB[currentUser];

    // Card do Admin
    const cardAdmin = document.getElementById('mod-admin');
    if (userObj.isAdmin) {
        cardAdmin.classList.remove('hidden');
    } else {
        cardAdmin.classList.add('hidden');
    }

    // Gerenciar avisos visuais de travas
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

// Clique nos Módulos
document.querySelectorAll('.module-card').forEach(card => {
    card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        
        const moduleName = card.getAttribute('data-module');
        const userObj = usersDB[currentUser];

        if (moduleName === 'admin' && userObj.isAdmin) {
            showScreen(screenAdmin);
            renderAdminRequests(); // Atualiza a lista de requisições pendentes
            injectAdminActionButtons(); // Prepara área de botões extras caso não existam
            return;
        }

        // Verifica permissão comum
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
            alert("ERRO_DE_SEGURANÇA: Você não possui diretivas de acesso a este módulo. Contate o Administrador.");
        }
    });
});

// Botões de Voltar para o Menu Principal
document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
        currentActiveModule = null;
        showScreen(screenMenu);
        renderMenu();
    });
});

// Registrar botões de Logoff globais
document.querySelectorAll('.btn-trigger-logout').forEach(btn => {
    btn.addEventListener('click', handleLogout);
});


// ================= FLUXO DE SOLICITAÇÃO E CADASTRO =================

// Links de transição da interface de login/cadastro
const linkGoRegister = document.getElementById('link-go-register');
const linkBackLogin = document.getElementById('link-back-login');

if (linkGoRegister) {
    linkGoRegister.addEventListener('click', (e) => {
        e.preventDefault();
        showScreen(screenRegister);
    });
}

if (linkBackLogin) {
    linkBackLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showScreen(screenLogin);
    });
}

// Processamento do Envio de Solicitação
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
            alert("SISTEMA: Identidade rejeitada. Este usuário já se encontra registrado e ativo.");
            return;
        }

        // Cria apenas o registro na lista de requisições pendentes no LocalStorage
        const newRequest = {
            username: userReg,
            email: emailReg,
            permissions: { financas: reqFin, almoxarifado: reqAlm, manutencao: reqMan }
        };

        requestsDB.push(newRequest);
        localStorage.setItem('sys_requests_db', JSON.stringify(requestsDB));

        alert("SOLICITAÇÃO PROTOCOLADA!\nSuas credenciais foram encaminhadas ao painel administrativo para validação.");
        
        // Limpa o formulário
        document.getElementById('reg-username').value = "";
        document.getElementById('reg-email').value = "";
        document.getElementById('reg-req-financas').checked = false;
        document.getElementById('reg-req-almoxarifado').checked = false;
        document.getElementById('reg-req-manutencao').checked = false;
        
        showScreen(screenLogin);
    });
}

// Lógica de Redefinição Obrigatória de Senha
const btnChangePasswordSubmit = document.getElementById('btn-change-password-submit');
if (btnChangePasswordSubmit) {
    btnChangePasswordSubmit.addEventListener('click', () => {
        const newPass = document.getElementById('force-new-password').value;
        const confPass = document.getElementById('force-confirm-password').value;

        if (!newPass) { alert("SISTEMA: Campo de nova senha inválido."); return; }
        if (newPass !== confPass) { alert("SISTEMA: Erro de checagem. As senhas informadas não coincidem."); return; }

        // Atualiza a senha e remove o token de conta temporária
        usersDB[userPendingPasswordForce].password = newPass;
        usersDB[userPendingPasswordForce].isTemporary = false;
        localStorage.setItem('sys_users_db', JSON.stringify(usersDB));

        alert("DIRETIVAS ATUALIZADAS!\nSenha permanente configurada com sucesso. Inicializando ecossistema...");
        
        currentUser = userPendingPasswordForce;
        sessionStorage.setItem('logged_user', currentUser);
        userPendingPasswordForce = null;
        
        document.getElementById('force-new-password').value = "";
        document.getElementById('force-confirm-password').value = "";
        
        showScreen(screenMenu);
        renderMenu();
    });
}


// ================= GESTÃO DE AGUARDO / ANÁLISE DO ADMIN =================
function renderAdminRequests() {
    const container = document.getElementById('admin-requests-container');
    if (!container) return;
    container.innerHTML = "";

    if (requestsDB.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); font-size:13px;">[PROVISIONAMENTO]: Nenhuma solicitação pendente no banco de dados.</p>`;
        return;
    }

    requestsDB.forEach((req, index) => {
        const card = document.createElement('div');
        card.classList.add('request-card');
        
        const mods = [];
        if (req.permissions.financas) mods.push("Finanças");
        if (req.permissions.almoxarifado) mods.push("Almoxarifado");
        if (req.permissions.manutencao) mods.push("Manutenção");

        card.innerHTML = `
            <div class="request-card-header">
                <strong>Operador: ${req.username.toUpperCase()}</strong>
                <span style="color: var(--color-primary)">${req.email}</span>
            </div>
            <p style="font-size: 13px;"><strong>Módulos Pretendidos:</strong> ${mods.join(', ') || 'Nenhum'}</p>
            <div class="request-actions">
                <button class="btn-approve" data-idx="${index}"><i class="fas fa-check"></i> Aprovar Acesso</button>
                <button class="btn-deny" data-idx="${index}"><i class="fas fa-times"></i> Rejeitar</button>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', (e) => { approveUser(parseInt(e.currentTarget.getAttribute('data-idx')), e.currentTarget); });
    });
    container.querySelectorAll('.btn-deny').forEach(btn => {
        btn.addEventListener('click', (e) => { denyUser(parseInt(e.currentTarget.getAttribute('data-idx')), e.currentTarget); });
    });
}

function approveUser(index, targetButton) {
    const req = requestsDB[index];
    
    if (targetButton) {
        targetButton.disabled = true;
        targetButton.innerHTML = "Enviando e-mail...";
    }

    const temporaryPassword = Math.floor(100000 + Math.random() * 900000).toString();

    usersDB[req.username] = {
        password: temporaryPassword,
        displayName: req.username.toUpperCase() + "_USER",
        isAdmin: false,
        isTemporary: true,
        isBlocked: false,
        email: req.email,
        permissions: { 
            financas: req.permissions.financas, 
            almoxarifado: req.permissions.almoxarifado, 
            manutencao: req.permissions.manutencao 
        }
    };

    emailjs.send("default_service", "template_7ig858y", {
        to_email: req.email,              
        username: req.username.toUpperCase(), 
        senha_temporaria: temporaryPassword   
    })
    .then(() => {
        localStorage.setItem('sys_users_db', JSON.stringify(usersDB));
        requestsDB.splice(index, 1);
        localStorage.setItem('sys_requests_db', JSON.stringify(requestsDB));
        
        alert(`SISTEMA: Usuário aprovado com sucesso! E-mail oficial enviado para: ${req.email}`);
    })
    .catch((error) => {
        alert("SISTEMA: Erro crítico ao enviar e-mail real. Verifique as chaves e o console.");
        console.error("Erro EmailJS:", error);
    })
    .finally(() => {
        renderAdminRequests();
    });
}

function denyUser(index, targetButton) {
    const req = requestsDB[index];
    
    const motive = prompt(`Informe o motivo técnico da rejeição para o operador ${req.username.toUpperCase()}:`);
    if (motive === null) return; 
    
    const finalMotive = motive.trim() || "Nenhum motivo específico foi detalhado pela equipe de segurança.";

    if (targetButton) {
        targetButton.disabled = true;
        targetButton.innerHTML = "Processando recusa...";
    }

    emailjs.send("default_service", "template_v5wk5hw", {
        to_email: req.email,              
        username: req.username.toUpperCase(), 
        motivo: finalMotive   
    })
    .then(() => {
        requestsDB.splice(index, 1);
        localStorage.setItem('sys_requests_db', JSON.stringify(requestsDB));
        alert(`SISTEMA: Notificação de recusa enviada com sucesso para: ${req.email}`);
    })
    .catch((error) => {
        alert("SISTEMA: Erro crítico ao enviar e-mail de recusa. Verifique as chaves e o console.");
        console.error("Erro EmailJS:", error);
    })
    .finally(() => {
        renderAdminRequests();
    });
}


// ================= SEÇÃO ADMINISTRATIVA (PERMISSÕES E MODERAÇÃO) =================

function injectAdminActionButtons() {
    if (document.getElementById('btn-admin-block-user')) return; 

    const containerSave = document.getElementById('btn-save-permissions');
    if (!containerSave) return;

    const wrapper = document.createElement('div');
    wrapper.style.display = "flex";
    wrapper.style.gap = "10px";
    wrapper.style.marginTop = "15px";

    const btnBlock = document.createElement('button');
    btnBlock.id = 'btn-admin-block-user';
    btnBlock.className = 'btn-sys';
    btnBlock.style.backgroundColor = '#d35400';
    btnBlock.style.color = '#fff';
    btnBlock.innerHTML = `<i class="fas fa-ban"></i> <span id="label-block-txt">Bloquear Usuário</span>`;

    const btnDelete = document.createElement('button');
    btnDelete.id = 'btn-admin-delete-user';
    btnDelete.className = 'btn-sys btn-sys-danger';
    btnDelete.innerHTML = `<i class="fas fa-user-slash"></i> Excluir Conta`;

    wrapper.appendChild(btnBlock);
    wrapper.appendChild(btnDelete);

    containerSave.parentNode.insertBefore(wrapper, containerSave.nextSibling);

    btnBlock.addEventListener('click', () => {
        if (!userBeingEdited) return;
        if (userBeingEdited === 'altair') {
            alert("ERRO: O usuário mestre administrador root (altair) não pode ser bloqueado.");
            return;
        }

        const currentState = usersDB[userBeingEdited].isBlocked || false;
        usersDB[userBeingEdited].isBlocked = !currentState;
        localStorage.setItem('sys_users_db', JSON.stringify(usersDB));

        if (usersDB[userBeingEdited].isBlocked) {
            alert(`SISTEMA: O usuário ${userBeingEdited.toUpperCase()} foi BLOQUEADO.`);
            btnBlock.style.backgroundColor = '#27ae60';
            document.getElementById('label-block-txt').innerText = "Desbloquear Usuário";
        } else {
            alert(`SISTEMA: O usuário ${userBeingEdited.toUpperCase()} foi DESBLOQUEADO.`);
            btnBlock.style.backgroundColor = '#d35400';
            document.getElementById('label-block-txt').innerText = "Bloquear Usuário";
        }
    });

    btnDelete.addEventListener('click', () => {
        if (!userBeingEdited) return;
        if (userBeingEdited === 'altair') {
            alert("ERRO: O administrador root master (altair) não pode ser removido.");
            return;
        }

        if (confirm(`⚠️ ALERTA DE EXCLUSÃO CRÍTICA ⚠️\n\nTem certeza de que deseja apagar o usuário ${userBeingEdited.toUpperCase()} permanentemente da base de dados?`)) {
            delete usersDB[userBeingEdited];
            localStorage.setItem('sys_users_db', JSON.stringify(usersDB));
            
            alert("SISTEMA: Registro eliminado com sucesso da árvore do diretório.");
            permissionsCard.classList.add('hidden');
            searchUserInput.value = "";
            userBeingEdited = null;
        }
    });
}

btnSearchUser.addEventListener('click', () => {
    const query = searchUserInput.value.trim().toLowerCase();
    
    if (usersDB[query]) {
        userBeingEdited = query;
        editingUserTitle.innerText = `EDITANDO_DIRETIVAS: ${query.toUpperCase()}`;
        
        // CORRIGIDO: Removido erro de digitação original "permissions.financianca"
        chkFinancas.checked = usersDB[query].permissions.financas;
        chkAlmoxarifado.checked = usersDB[query].permissions.almoxarifado;
        chkManutencao.checked = usersDB[query].permissions.manutencao;
        
        const btnBlock = document.getElementById('btn-admin-block-user');
        if (btnBlock) {
            if (usersDB[query].isBlocked) {
                btnBlock.style.backgroundColor = '#27ae60';
                document.getElementById('label-block-txt').innerText = "Desbloquear Usuário";
            } else {
                btnBlock.style.backgroundColor = '#d35400';
                document.getElementById('label-block-txt').innerText = "Bloquear Usuário";
            }
        }

        permissionsCard.classList.remove('hidden');
    } else {
        alert("SISTEMA: Usuário não localizado na árvore de diretórios.");
        permissionsCard.classList.add('hidden');
        userBeingEdited = null;
    }
});

btnSavePermissions.addEventListener('click', () => {
    if (!userBeingEdited) return;

    usersDB[userBeingEdited].permissions.financas = chkFinancas.checked;
    usersDB[userBeingEdited].permissions.almoxarifado = chkAlmoxarifado.checked;
    usersDB[userBeingEdited].permissions.manutencao = chkManutencao.checked;

    localStorage.setItem('sys_users_db', JSON.stringify(usersDB));
    alert(`DIRETIVAS ATUALIZADAS: Permissões de ${userBeingEdited.toUpperCase()} aplicadas com sucesso.`);
    
    permissionsCard.classList.add('hidden');
    searchUserInput.value = "";
});


// ================= MÓDULO: FINANÇAS (ENGINE ORIGINAL) =================
function loadFinancasData() {
    const storageKey = `my_finances_data_${currentUser}`;
    transactions = JSON.parse(localStorage.getItem(storageKey)) || [];
    updateBalances();
    renderList();
}

function formatCurrency(value) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function updateBalances() {
    let entries = 0, expenses = 0;
    transactions.forEach(item => {
        if (!item.completed) {
            if (item.type === 'entrada') entries += item.value;
            else expenses += item.value;
        }
    });
    totalBalance.innerText = formatCurrency(entries - expenses);
    totalEntries.innerText = formatCurrency(entries);
    totalExpenses.innerText = formatCurrency(expenses);
}

function renderList() {
    listContainer.innerHTML = '';
    if (transactions.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px; padding:20px;">[SISTEMA_VAZIO]: SEM LANÇAMENTOS</p>';
        return;
    }
    transactions.forEach((item, index) => {
        const div = document.createElement('div');
        div.classList.add('transaction-item', `item-${item.type}`);
        if (item.completed) div.classList.add('completed');
        div.addEventListener('click', () => toggleComplete(index));
        div.innerHTML = `
            <div class="item-left">
                <div class="check-box">${item.completed ? '✓' : ''}</div>
                <span class="item-info">${item.title}</span>
            </div>
            <span class="item-value">${item.type === 'entrada' ? '+' : '-'} ${formatCurrency(item.value)}</span>
        `;
        listContainer.appendChild(div);
    });
}

function toggleComplete(index) {
    transactions[index].completed = !transactions[index].completed;
    saveFinancasData(); updateBalances(); renderList();
}

function addTransaction() {
    const title = transTitleInput.value.trim();
    const value = parseFloat(transValueInput.value);
    const type = transTypeSelect.value;

    if (!title || isNaN(value) || value <= 0) {
        alert('OPERAÇÃO RECUSADA: DADOS INCORRETOS.');
        return;
    }
    transactions.push({ title, value, type, completed: false });
    transTitleInput.value = ''; transValueInput.value = '';
    saveFinancasData(); updateBalances(); renderList();
}

function saveFinancasData() {
    const storageKey = `my_finances_data_${currentUser}`;
    localStorage.setItem(storageKey, JSON.stringify(transactions));
}

btnSaveTransaction.addEventListener('click', addTransaction);
btnClearTransactions.addEventListener('click', () => {
    if (confirm('Deseja deletar permanentemente a tabela deste usuário?')) {
        transactions = []; saveFinancasData(); updateBalances(); renderList();
    }
});


// ================= MÓDULO: ALMOXARIFADO (NOVA ENGINE DE ESTOQUE) =================
function loadAlmoxarifadoData() {
    const storageKey = `my_stock_data_${currentUser}`;
    stockItems = JSON.parse(localStorage.getItem(storageKey)) || [];
    renderStockTable();
}

function saveAlmoxarifadoData() {
    const storageKey = `my_stock_data_${currentUser}`;
    localStorage.setItem(storageKey, JSON.stringify(stockItems));
}

function renderStockTable() {
    if (!stockTableBody) return;
    stockTableBody.innerHTML = '';

    if (stockItems.length === 0) {
        stockTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; font-size:12px; padding:20px;">[ALMOXARIFADO_VAZIO]: NENHUM PRODUTO REGISTRADO</td></tr>`;
        return;
    }

    stockItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // Ativa classe crítica caso estoque esteja em níveis iguais ou inferiores ao mínimo
        if (item.qty <= item.minQty) {
            tr.classList.add('stock-row-critical');
        }

        tr.innerHTML = `
            <td><strong>#${index + 1}</strong></td>
            <td>${item.name.toUpperCase()}</td>
            <td>${item.qty} un</td>
            <td>${item.minQty} un</td>
            <td>
                <button class="btn-stock-action" onclick="changeStockQty(${index}, 1)"><i class="fas fa-plus"></i> Entrada</button>
                <button class="btn-stock-action" onclick="changeStockQty(${index}, -1)"><i class="fas fa-minus"></i> Baixa</button>
                <button class="btn-stock-action btn-stock-danger" onclick="deleteStockItem(${index})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        stockTableBody.appendChild(tr);
    });
}

function addStockItem() {
    const name = prodNameInput.value.trim();
    const qty = parseInt(prodQtyInput.value);
    const minQty = parseInt(prodMinInput.value);

    if (!name || isNaN(qty) || qty < 0 || isNaN(minQty) || minQty < 0) {
        alert('OPERAÇÃO RECUSADA: CERTIFIQUE-SE DE QUE OS VALORES SÃO VÁLIDOS E MAIORES OU IGUAIS A ZERO.');
        return;
    }

    // Evita duplicações de nomes no estoque do mesmo operador
    const existIndex = stockItems.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
    if (existIndex !== -1) {
        alert('AVISO: Esse produto já existe. Utilize os botões de controle na tabela para ajustar o saldo.');
        return;
    }

    stockItems.push({ name, qty, minQty });
    prodNameInput.value = ''; prodQtyInput.value = ''; prodMinInput.value = '';
    
    saveAlmoxarifadoData();
    renderStockTable();
}

// Funções expostas globalmente (window) para responderem aos cliques em linhas da tabela de estoque
window.changeStockQty = function(index, amount) {
    const targetItem = stockItems[index];
    if (amount < 0 && targetItem.qty + amount < 0) {
        alert('ERRO OPERACIONAL: Saldo em estoque insuficiente para realizar esta baixa.');
        return;
    }
    targetItem.qty += amount;
    saveAlmoxarifadoData();
    renderStockTable();
};

window.deleteStockItem = function(index) {
    if (confirm(`Tem certeza que deseja remover o produto "${stockItems[index].name.toUpperCase()}" do almoxarifado?`)) {
        stockItems.splice(index, 1);
        saveAlmoxarifadoData();
        renderStockTable();
    }
};

if (btnSaveProduct) {
    btnSaveProduct.addEventListener('click', addStockItem);
}


// ================= CONTROLE GLOBAL DE LOGIN POR EVENTO =================
passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
btnLogin.addEventListener('click', handleLogin);

// Inicialização do Sistema do Gate de segurança
if (currentUser) {
    showScreen(screenMenu); renderMenu();
} else {
    showScreen(screenLogin);
}