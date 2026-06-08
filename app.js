document.addEventListener('DOMContentLoaded', async () => {
    // ==== Supabase Config ====
    const supabaseUrl = 'https://groezaseypdbpgymgpvo.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2V6YXNleXBkYnBneW1ncHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjkxNjYsImV4cCI6MjA4MTY0NTE2Nn0.5U5QeoGmZn_i9Y8POoUCkatBUAdSW-cjHRyfxpm_pyM';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    // ==== UI & Tabs ====
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

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
    let buggyTransactions = [];
    let personalDebts = [];
    let editingCobrancaId = null;

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // ==== Fetch Data from Supabase ====
    const loadData = async () => {
        // Load Buggy Transactions
        const { data: bData, error: bError } = await supabase
            .from('buggy_transactions')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!bError && bData) {
            buggyTransactions = bData;
        } else {
            console.error('Erro ao buscar transações do buggy:', bError);
        }

        // Load Personal Debts
        const { data: pData, error: pError } = await supabase
            .from('personal_debts')
            .select('*')
            .order('created_at', { ascending: false });

        if (!pError && pData) {
            personalDebts = pData;
        } else {
            console.error('Erro ao buscar cobranças:', pError);
        }

        updateBuggySummary();
        renderBuggyTable();
        renderCobrancas();
    };

    // ==== Buggy Control Logic ====
    const buggyForm = document.getElementById('buggy-form');
    const buggyTbody = document.getElementById('buggy-tbody');

    const updateBuggySummary = () => {
        let receita = 0;
        let despesas = 0;
        let comissaoTotal = 0;

        buggyTransactions.forEach(t => {
            if(t.tipo === 'receita') {
                receita += parseFloat(t.valor);
                comissaoTotal += parseFloat(t.comissao_value || 0);
            } else {
                despesas += parseFloat(t.valor);
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

        if (buggyTransactions.length === 0) {
            buggyTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-secondary);">Nenhuma transação registrada.</td></tr>`;
            return;
        }

        buggyTransactions.forEach(t => {
            const tr = document.createElement('tr');
            
            const comissaoText = t.tipo === 'receita' ? formatCurrency(t.comissao_value || 0) : '-';
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

    buggyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tipo = document.getElementById('b-tipo').value;
        const descricao = document.getElementById('b-descricao').value;
        const valor = parseFloat(document.getElementById('b-valor').value);
        const status = document.getElementById('b-status').value;
        let comissao_value = 0;

        if (tipo === 'receita') {
            comissao_value = parseFloat(document.getElementById('b-comissao-valor').value) || 0;
        }

        const submitBtn = buggyForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Salvando...';
        submitBtn.disabled = true;

        const { data, error } = await supabase
            .from('buggy_transactions')
            .insert([
                { tipo, descricao, valor, comissao_value, status }
            ])
            .select();

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        if (!error && data) {
            buggyTransactions.unshift(data[0]);
            buggyForm.reset();
            document.getElementById('b-comissao-valor').value = '';
            document.getElementById('b-tipo').value = 'receita';
            colComissao.style.display = 'block';
            
            updateBuggySummary();
            renderBuggyTable();
        } else {
            alert('Erro ao salvar transação: ' + error.message);
        }
    });

    window.deletarBuggy = async (id) => {
        if(confirm('Tem certeza que deseja deletar esta transação?')) {
            const { error } = await supabase
                .from('buggy_transactions')
                .delete()
                .eq('id', id);

            if (!error) {
                buggyTransactions = buggyTransactions.filter(t => t.id !== id);
                updateBuggySummary();
                renderBuggyTable();
            } else {
                alert('Erro ao deletar: ' + error.message);
            }
        }
    };

    window.marcarBuggyPago = async (id) => {
        const { data, error } = await supabase
            .from('buggy_transactions')
            .update({ status: 'pago' })
            .eq('id', id)
            .select();

        if (!error && data) {
            const index = buggyTransactions.findIndex(t => t.id === id);
            if(index !== -1) {
                buggyTransactions[index].status = 'pago';
                renderBuggyTable();
            }
        } else {
            alert('Erro ao atualizar: ' + error.message);
        }
    };

    // ==== Cobrancas Logic ====
    const cobrancaForm = document.getElementById('cobranca-form');
    const cobrancasList = document.getElementById('cobrancas-list');

    const renderCobrancas = () => {
        cobrancasList.innerHTML = '';

        if (personalDebts.length === 0) {
            cobrancasList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Nenhuma cobrança cadastrada.</p>';
            return;
        }

        personalDebts.forEach(c => {
            const div = document.createElement('div');
            div.className = 'cobranca-item';
            
            let dateStr = c.data_vencimento;
            if(c.data_vencimento) {
                const parts = c.data_vencimento.split('-');
                if(parts.length === 3) {
                    dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
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

    cobrancaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('c-nome').value;
        const descricao = document.getElementById('c-descricao').value;
        const valor = parseFloat(document.getElementById('c-valor').value);
        const data_vencimento = document.getElementById('c-data').value;
        
        const submitBtn = document.getElementById('c-submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Salvando...';
        submitBtn.disabled = true;

        if (editingCobrancaId) {
            const { data, error } = await supabase
                .from('personal_debts')
                .update({ nome, descricao, valor, data_vencimento })
                .eq('id', editingCobrancaId)
                .select();

            if (!error && data) {
                const index = personalDebts.findIndex(c => c.id === editingCobrancaId);
                if(index !== -1) {
                    personalDebts[index] = data[0];
                }
                editingCobrancaId = null;
                document.getElementById('c-submit-btn').textContent = 'Adicionar Cobrança';
                document.getElementById('c-cancel-btn').style.display = 'none';
                cobrancaForm.reset();
                renderCobrancas();
            } else {
                alert('Erro ao atualizar: ' + error.message);
            }
        } else {
            const { data, error } = await supabase
                .from('personal_debts')
                .insert([
                    { nome, descricao, valor, data_vencimento, status: 'pendente' }
                ])
                .select();

            if (!error && data) {
                personalDebts.unshift(data[0]);
                cobrancaForm.reset();
                renderCobrancas();
            } else {
                alert('Erro ao salvar cobrança: ' + error.message);
            }
        }

        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
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
        document.getElementById('c-data').value = cobranca.data_vencimento;
        
        editingCobrancaId = id;
        document.getElementById('c-submit-btn').textContent = 'Salvar Alterações';
        document.getElementById('c-cancel-btn').style.display = 'block';
        
        document.getElementById('cobranca-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.deletarCobranca = async (id) => {
        if(confirm('Tem certeza que deseja deletar esta cobrança?')) {
            const { error } = await supabase
                .from('personal_debts')
                .delete()
                .eq('id', id);

            if (!error) {
                personalDebts = personalDebts.filter(c => c.id !== id);
                renderCobrancas();
            } else {
                alert('Erro ao deletar: ' + error.message);
            }
        }
    };

    window.marcarCobrancaPago = async (id) => {
        const { data, error } = await supabase
            .from('personal_debts')
            .update({ status: 'pago' })
            .eq('id', id)
            .select();

        if (!error && data) {
            const index = personalDebts.findIndex(c => c.id === id);
            if(index !== -1) {
                personalDebts[index].status = 'pago';
                renderCobrancas();
            }
        } else {
            alert('Erro ao atualizar: ' + error.message);
        }
    };

    // Initialize fetching data
    loadData();
});
