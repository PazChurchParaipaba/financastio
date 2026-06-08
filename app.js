document.addEventListener('DOMContentLoaded', () => {
    // ==== UI & Tabs ====
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    // Display current date
    const dateDisplay = document.getElementById('current-date');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    dateDisplay.innerHTML = `<i class="ph ph-calendar-blank" style="margin-right: 6px; vertical-align: middle;"></i> ${today.toLocaleDateString('pt-BR', options)}`;

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));

            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Toggle Comissao field based on Tipo
    const bTipoSelect = document.getElementById('b-tipo');
    const colComissao = document.getElementById('col-comissao');
    const bComissaoValor = document.getElementById('b-comissao-valor');

    bTipoSelect.addEventListener('change', (e) => {
        if(e.target.value === 'despesa') {
            colComissao.style.display = 'none';
            bComissaoValor.value = '';
        } else {
            colComissao.style.display = 'block';
            bComissaoValor.value = '';
        }
    });

    // ==== State Management ====
    let buggyTransactions = JSON.parse(localStorage.getItem('buggyTransactions')) || [];
    let personalDebts = JSON.parse(localStorage.getItem('personalDebts')) || [];

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const generateId = () => Math.random().toString(36).substr(2, 9);

    // ==== Buggy Control Logic ====
    const buggyForm = document.getElementById('buggy-form');
    const buggyTbody = document.getElementById('buggy-tbody');

    const updateBuggySummary = () => {
        let receita = 0;
        let despesas = 0;
        let comissaoTotal = 0;

        buggyTransactions.forEach(t => {
            if(t.tipo === 'receita') {
                receita += t.valor;
                comissaoTotal += t.comissaoValue;
            } else {
                despesas += t.valor;
            }
        });

        const liquido = receita - despesas - comissaoTotal;

        document.getElementById('buggy-receita').textContent = formatCurrency(receita);
        document.getElementById('buggy-despesas').textContent = formatCurrency(despesas);
        document.getElementById('buggy-comissao').textContent = formatCurrency(comissaoTotal);
        document.getElementById('buggy-liquido').textContent = formatCurrency(liquido);
    };

    const renderBuggyTable = () => {
        buggyTbody.innerHTML = '';
        const reversed = [...buggyTransactions].reverse();

        if (reversed.length === 0) {
            buggyTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-secondary);">Nenhuma transação registrada.</td></tr>`;
            return;
        }

        reversed.forEach(t => {
            const tr = document.createElement('tr');
            
            const comissaoText = t.tipo === 'receita' ? formatCurrency(t.comissaoValue) : '-';
            const tipoText = t.tipo === 'receita' ? '<span class="positive"><i class="ph ph-arrow-down-left"></i> Receita</span>' : '<span class="negative"><i class="ph ph-arrow-up-right"></i> Despesa</span>';

            tr.innerHTML = `
                <td><strong>${t.descricao}</strong></td>
                <td>${tipoText}</td>
                <td><strong>${formatCurrency(t.valor)}</strong></td>
                <td>${comissaoText}</td>
                <td><span class="status-badge status-${t.status}">${t.status.toUpperCase()}</span></td>
                <td class="action-btns">
                    ${t.status === 'pendente' ? `<button class="btn btn-sm btn-success" onclick="marcarBuggyPago('${t.id}')" title="Marcar como Pago"><i class="ph ph-check"></i></button>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="deletarBuggy('${t.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                </td>
            `;
            buggyTbody.appendChild(tr);
        });
    };

    buggyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const tipo = document.getElementById('b-tipo').value;
        const descricao = document.getElementById('b-descricao').value;
        const valor = parseFloat(document.getElementById('b-valor').value);
        const status = document.getElementById('b-status').value;
        let comissaoValue = 0;

        if (tipo === 'receita') {
            comissaoValue = parseFloat(document.getElementById('b-comissao-valor').value) || 0;
        }

        const transacao = {
            id: generateId(),
            date: new Date().toISOString(),
            tipo,
            descricao,
            valor,
            comissaoValue,
            status
        };

        buggyTransactions.push(transacao);
        localStorage.setItem('buggyTransactions', JSON.stringify(buggyTransactions));
        
        buggyForm.reset();
        document.getElementById('b-comissao-valor').value = '';
        document.getElementById('b-tipo').value = 'receita';
        colComissao.style.display = 'block';
        
        updateBuggySummary();
        renderBuggyTable();
    });

    window.deletarBuggy = (id) => {
        if(confirm('Tem certeza que deseja deletar esta transação?')) {
            buggyTransactions = buggyTransactions.filter(t => t.id !== id);
            localStorage.setItem('buggyTransactions', JSON.stringify(buggyTransactions));
            updateBuggySummary();
            renderBuggyTable();
        }
    };

    window.marcarBuggyPago = (id) => {
        const transacao = buggyTransactions.find(t => t.id === id);
        if(transacao) {
            transacao.status = 'pago';
            localStorage.setItem('buggyTransactions', JSON.stringify(buggyTransactions));
            renderBuggyTable();
        }
    };

    // ==== Cobrancas Logic ====
    const cobrancaForm = document.getElementById('cobranca-form');
    const cobrancasList = document.getElementById('cobrancas-list');
    let editingCobrancaId = null;

    const renderCobrancas = () => {
        cobrancasList.innerHTML = '';
        const reversed = [...personalDebts].reverse();

        if (reversed.length === 0) {
            cobrancasList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Nenhuma cobrança cadastrada.</p>';
            return;
        }

        reversed.forEach(c => {
            const div = document.createElement('div');
            div.className = 'cobranca-item';
            
            let dateStr = c.data;
            if(c.data) {
                const dateObj = new Date(c.data);
                dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());
                dateStr = dateObj.toLocaleDateString('pt-BR');
            }

            div.innerHTML = `
                <div class="cobranca-info">
                    <h4>${c.nome}</h4>
                    <p>${c.descricao} • Vencimento: ${dateStr}</p>
                    <div class="action-btns" style="margin-top: 16px;">
                        ${c.status === 'pendente' ? `<button class="btn btn-sm btn-success" onclick="marcarCobrancaPago('${c.id}')"><i class="ph ph-check-circle"></i> Marcar Pago</button>` : ''}
                        <button class="btn btn-sm" style="background-color: var(--sidebar-bg); border: 1px solid var(--border-color); color: var(--text-primary);" onclick="editarCobranca('${c.id}')"><i class="ph ph-pencil"></i> Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="deletarCobranca('${c.id}')"><i class="ph ph-trash"></i> Excluir</button>
                    </div>
                </div>
                <div class="cobranca-value-status">
                    <strong class="${c.status === 'pago' ? 'positive' : 'warning'}">${formatCurrency(c.valor)}</strong>
                    <span class="status-badge status-${c.status}">${c.status.toUpperCase()}</span>
                </div>
            `;
            cobrancasList.appendChild(div);
        });
    };

    cobrancaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('c-nome').value;
        const descricao = document.getElementById('c-descricao').value;
        const valor = parseFloat(document.getElementById('c-valor').value);
        const data = document.getElementById('c-data').value;
        
        if (editingCobrancaId) {
            const index = personalDebts.findIndex(c => c.id === editingCobrancaId);
            if(index !== -1) {
                personalDebts[index].nome = nome;
                personalDebts[index].descricao = descricao;
                personalDebts[index].valor = valor;
                personalDebts[index].data = data;
            }
            editingCobrancaId = null;
            document.getElementById('c-submit-btn').textContent = 'Adicionar Cobrança';
            document.getElementById('c-cancel-btn').style.display = 'none';
        } else {
            const cobranca = {
                id: generateId(),
                nome,
                descricao,
                valor,
                data,
                status: 'pendente'
            };
            personalDebts.push(cobranca);
        }

        localStorage.setItem('personalDebts', JSON.stringify(personalDebts));
        
        cobrancaForm.reset();
        renderCobrancas();
    });

    document.getElementById('c-cancel-btn').addEventListener('click', () => {
        editingCobrancaId = null;
        cobrancaForm.reset();
        document.getElementById('c-submit-btn').textContent = 'Adicionar Cobrança';
        document.getElementById('c-cancel-btn').style.display = 'none';
    });

    window.editarCobranca = (id) => {
        const cobranca = personalDebts.find(c => c.id === id);
        if(!cobranca) return;

        document.getElementById('c-nome').value = cobranca.nome;
        document.getElementById('c-descricao').value = cobranca.descricao;
        document.getElementById('c-valor').value = cobranca.valor;
        document.getElementById('c-data').value = cobranca.data;
        
        editingCobrancaId = id;
        document.getElementById('c-submit-btn').textContent = 'Salvar Alterações';
        document.getElementById('c-cancel-btn').style.display = 'block';
        
        // Scroll up to form smoothly
        document.getElementById('cobranca-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.deletarCobranca = (id) => {
        if(confirm('Tem certeza que deseja deletar esta cobrança?')) {
            personalDebts = personalDebts.filter(c => c.id !== id);
            localStorage.setItem('personalDebts', JSON.stringify(personalDebts));
            renderCobrancas();
        }
    };

    window.marcarCobrancaPago = (id) => {
        const cobranca = personalDebts.find(c => c.id === id);
        if(cobranca) {
            cobranca.status = 'pago';
            localStorage.setItem('personalDebts', JSON.stringify(personalDebts));
            renderCobrancas();
        }
    };

    // Initialize
    updateBuggySummary();
    renderBuggyTable();
    renderCobrancas();
});
