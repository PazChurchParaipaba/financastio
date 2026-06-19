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
    let geralTransactions = [];
    let emprestimosTransactions = [];
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

        // Load General Transactions
        const { data: gData, error: gError } = await supabase
            .from('general_transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (!gError && gData) {
            geralTransactions = gData;
        } else {
            console.error('Erro ao buscar transações gerais:', gError);
        }

        // Load Emprestimos
        const { data: eData, error: eError } = await supabase
            .from('loans')
            .select('*')
            .order('created_at', { ascending: false });

        if (!eError && eData) {
            emprestimosTransactions = eData;
        } else {
            console.error('Erro ao buscar empréstimos:', eError);
        }

        updateBuggySummary();
        renderBuggyTable();
        renderCobrancas();
        if(typeof renderComissoes === 'function') renderComissoes();
        updateGeralSummary();
        renderGeralTable();
        updateEmprestimosSummary();
        renderEmprestimosTable();
    };

    // ==== Buggy Control Logic ====
    const buggyForm = document.getElementById('buggy-form');
    const buggyTbody = document.getElementById('buggy-tbody');
    const bDataInput = document.getElementById('b-data');
    if (bDataInput) bDataInput.valueAsDate = new Date();

    const buggyPeriodFilter = document.getElementById('buggy-period-filter');
    if (buggyPeriodFilter) {
        buggyPeriodFilter.addEventListener('change', () => updateBuggySummary());
    }

    const updateBuggySummary = () => {
        let receita = 0;
        let despesas = 0;
        let comissaoTotal = 0;
        let comissaoPagaTotal = 0;
        const filterValue = buggyPeriodFilter ? buggyPeriodFilter.value : 'all';
        const now = new Date();

        buggyTransactions.forEach(t => {
            let include = true;
            if (t.date && filterValue !== 'all') {
                const tDate = new Date(t.date);
                tDate.setMinutes(tDate.getMinutes() + tDate.getTimezoneOffset());
                
                if (filterValue === 'month') {
                    if (tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear()) {
                        include = false;
                    }
                } else if (filterValue === 'week') {
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() - now.getDay());
                    startOfWeek.setHours(0,0,0,0);
                    
                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(startOfWeek.getDate() + 6);
                    endOfWeek.setHours(23,59,59,999);
                    
                    if (tDate < startOfWeek || tDate > endOfWeek) {
                        include = false;
                    }
                }
            }

            if (include) {
                if(t.tipo === 'receita') {
                    receita += parseFloat(t.valor);
                    const val = parseFloat(t.comissao_value || 0);
                    comissaoTotal += val;
                    if ((t.descricao || '').includes('(Comissão Paga)')) {
                        comissaoPagaTotal += val;
                    }
                } else {
                    despesas += parseFloat(t.valor);
                }
            }
        });

        const liquido = receita - despesas - comissaoPagaTotal;

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
            
            let dateStr = t.date;
            if(t.date) {
                const d = new Date(t.date);
                // Adjust to avoid timezone offset issues if it's stored as simple date
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                dateStr = d.toLocaleDateString('pt-BR');
            }

            const cleanDesc = t.descricao.replace('(Comissão Paga)', '').trim();
            const isComissaoPaga = (t.descricao || '').includes('(Comissão Paga)');
            
            let comissaoText = '-';
            if (t.tipo === 'receita') {
                comissaoText = formatCurrency(t.comissao_value || 0);
                if (parseFloat(t.comissao_value || 0) > 0) {
                    comissaoText += isComissaoPaga ? '<br><span style="font-size: 11px; color: var(--positive-color); font-weight: 600;">PAGA</span>' : '<br><span style="font-size: 11px; color: var(--warning-color); font-weight: 600;">PENDENTE</span>';
                }
            }

            const tipoText = t.tipo === 'receita' ? '<span class="positive"><i class="ph ph-arrow-down-left"></i> Receita</span>' : '<span class="negative"><i class="ph ph-arrow-up-right"></i> Despesa</span>';

            const valorLiquido = t.tipo === 'receita' ? (isComissaoPaga ? parseFloat(t.valor) - parseFloat(t.comissao_value || 0) : parseFloat(t.valor)) : parseFloat(t.valor);

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><strong>${cleanDesc}</strong></td>
                <td>${tipoText}</td>
                <td><strong>${formatCurrency(t.valor)}</strong></td>
                <td>${comissaoText}</td>
                <td style="color: var(--positive-color);"><strong>${formatCurrency(valorLiquido)}</strong></td>
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
        const dateInput = document.getElementById('b-data').value;
        let comissao_value = 0;

        if (tipo === 'receita') {
            const porcentagem = parseFloat(document.getElementById('b-comissao-valor').value) || 0;
            comissao_value = (valor * porcentagem) / 100;
        }

        const submitBtn = buggyForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Salvando...';
        submitBtn.disabled = true;

        const { data, error } = await supabase
            .from('buggy_transactions')
            .insert([
                { date: dateInput, tipo, descricao, valor, comissao_value, status }
            ])
            .select();

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        if (!error && data) {
            buggyTransactions.unshift(data[0]);
            buggyForm.reset();
            document.getElementById('b-data').valueAsDate = new Date();
            document.getElementById('b-comissao-valor').value = '';
            document.getElementById('b-tipo').value = 'receita';
            colComissao.style.display = 'block';
            
            updateBuggySummary();
            renderBuggyTable();
            if(typeof renderComissoes === 'function') renderComissoes();
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
                if(typeof renderComissoes === 'function') renderComissoes();
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

    // ==== PDF Export ====
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            const buggyTab = document.getElementById('buggy-tab');
            const formPanel = buggyTab.querySelector('.form-panel');
            const periodFilter = document.getElementById('buggy-period-filter');
            const actionCells = buggyTab.querySelectorAll('.data-table th:last-child, .data-table td:last-child');
            
            const originalExportBtnDisplay = exportPdfBtn.style.display;
            exportPdfBtn.style.display = 'none';
            if (periodFilter) periodFilter.style.display = 'none';
            if (formPanel) formPanel.style.display = 'none';
            actionCells.forEach(el => el.style.display = 'none');

            const originalWidth = buggyTab.style.width;
            buggyTab.style.width = '1100px';
            buggyTab.classList.add('pdf-export');

            const originalBtnText = exportPdfBtn.innerHTML;
            exportPdfBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Gerando...';
            exportPdfBtn.style.display = 'none'; // Keep hidden during print

            const opt = {
                margin:       0.3,
                filename:     `relatorio-buggy-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, backgroundColor: '#ffffff' },
                jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
            };

            html2pdf().set(opt).from(buggyTab).save().then(() => {
                // Restore UI
                exportPdfBtn.style.display = originalExportBtnDisplay;
                exportPdfBtn.innerHTML = originalBtnText;
                if (periodFilter) periodFilter.style.display = '';
                if (formPanel) formPanel.style.display = '';
                actionCells.forEach(el => el.style.display = '');
                buggyTab.style.width = originalWidth;
                buggyTab.classList.remove('pdf-export');
            });
        });
    }

    // ==== Comissoes Logic ====
    const comissoesTbody = document.getElementById('comissoes-tbody');
    
    window.renderComissoes = () => {
        if (!comissoesTbody) return;
        comissoesTbody.innerHTML = '';
        
        let pendentes = 0;
        let pagas = 0;

        const comissoes = buggyTransactions.filter(t => parseFloat(t.comissao_value || 0) > 0);

        if (comissoes.length === 0) {
            comissoesTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-secondary);">Nenhuma comissão registrada.</td></tr>`;
        }

        comissoes.forEach(t => {
            const isPaga = (t.descricao || '').includes('(Comissão Paga)');
            const valorComissao = parseFloat(t.comissao_value);
            
            if (isPaga) pagas += valorComissao;
            else pendentes += valorComissao;

            const tr = document.createElement('tr');
            
            let dateStr = t.date;
            if(t.date) {
                const d = new Date(t.date);
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                dateStr = d.toLocaleDateString('pt-BR');
            }

            const cleanDesc = t.descricao.replace('(Comissão Paga)', '').trim();
            const statusBadge = isPaga ? '<span class="status-badge status-pago">PAGA</span>' : '<span class="status-badge status-pendente">PENDENTE</span>';

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><strong>${cleanDesc}</strong></td>
                <td class="warning"><strong>${formatCurrency(valorComissao)}</strong></td>
                <td>${statusBadge}</td>
                <td class="action-btns">
                    ${!isPaga ? `<button class="btn btn-sm btn-success" onclick="marcarComissaoPaga('${t.id}')" title="Marcar como Paga"><i class="ph ph-check-circle"></i> Marcar Paga</button>` : ''}
                </td>
            `;
            comissoesTbody.appendChild(tr);
        });

        const elPendentes = document.getElementById('comissoes-pendentes');
        const elPagas = document.getElementById('comissoes-pagas');
        if (elPendentes) elPendentes.textContent = formatCurrency(pendentes);
        if (elPagas) elPagas.textContent = formatCurrency(pagas);
    };

    window.marcarComissaoPaga = async (id) => {
        const transaction = buggyTransactions.find(t => t.id === id);
        if(!transaction) return;

        const novaDescricao = transaction.descricao + ' (Comissão Paga)';
        
        const { error } = await supabase
            .from('buggy_transactions')
            .update({ descricao: novaDescricao })
            .eq('id', id);

        if (!error) {
            transaction.descricao = novaDescricao;
            renderComissoes();
            renderBuggyTable();
        } else {
            alert('Erro ao marcar comissão como paga: ' + error.message);
        }
    };

    // ==== Geral Logic ====
    const geralForm = document.getElementById('geral-form');
    const geralTbody = document.getElementById('geral-tbody');
    const gDataInput = document.getElementById('g-data');
    if (gDataInput) gDataInput.valueAsDate = new Date();

    const geralPeriodFilter = document.getElementById('geral-period-filter');
    if (geralPeriodFilter) {
        geralPeriodFilter.addEventListener('change', () => {
            updateGeralSummary();
            renderGeralTable();
        });
    }

    const getFilteredGeralTransactions = () => {
        const filterValue = geralPeriodFilter ? geralPeriodFilter.value : 'all';
        const now = new Date();

        return geralTransactions.filter(t => {
            if (!t.date || filterValue === 'all') return true;
            
            const tDate = new Date(t.date);
            tDate.setMinutes(tDate.getMinutes() + tDate.getTimezoneOffset());
            
            if (filterValue === 'month') {
                return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
            } else if (filterValue === 'last_month') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return tDate.getMonth() === lastMonth.getMonth() && tDate.getFullYear() === lastMonth.getFullYear();
            }
            return true;
        });
    };

    const updateGeralSummary = () => {
        let receita = 0;
        let despesa = 0;
        
        const filtered = getFilteredGeralTransactions();

        filtered.forEach(t => {
            if(t.tipo === 'receita') {
                receita += parseFloat(t.valor);
            } else {
                despesa += parseFloat(t.valor);
            }
        });

        const liquido = receita - despesa;

        const elReceita = document.getElementById('geral-receita');
        const elDespesa = document.getElementById('geral-despesa');
        const elLiquido = document.getElementById('geral-liquido');

        if(elReceita) elReceita.textContent = formatCurrency(receita);
        if(elDespesa) elDespesa.textContent = formatCurrency(despesa);
        if(elLiquido) elLiquido.textContent = formatCurrency(liquido);
    };

    const renderGeralTable = () => {
        if(!geralTbody) return;
        geralTbody.innerHTML = '';
        
        const filtered = getFilteredGeralTransactions();

        if (filtered.length === 0) {
            geralTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-secondary);">Nenhuma transação registrada.</td></tr>`;
            return;
        }

        filtered.forEach(t => {
            const tr = document.createElement('tr');
            
            let dateStr = t.date;
            if(t.date) {
                const d = new Date(t.date);
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                dateStr = d.toLocaleDateString('pt-BR');
            }

            const tipoText = t.tipo === 'receita' ? '<span class="positive"><i class="ph ph-arrow-down-left"></i> Receita</span>' : '<span class="negative"><i class="ph ph-arrow-up-right"></i> Despesa</span>';

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><strong>${t.descricao}</strong></td>
                <td>${tipoText}</td>
                <td><strong>${formatCurrency(t.valor)}</strong></td>
                <td><span class="status-badge status-${t.status}">${t.status.toUpperCase()}</span></td>
                <td class="action-btns">
                    ${t.status === 'pendente' ? `<button class="btn btn-sm btn-success" onclick="marcarGeralPago('${t.id}')" title="Marcar como Pago"><i class="ph ph-check"></i></button>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="deletarGeral('${t.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                </td>
            `;
            geralTbody.appendChild(tr);
        });
    };

    // ==== Geral PDF Export ====
    const exportGeralPdfBtn = document.getElementById('export-geral-pdf-btn');
    if (exportGeralPdfBtn) {
        exportGeralPdfBtn.addEventListener('click', () => {
            const geralTab = document.getElementById('geral-tab');
            const formPanel = geralTab.querySelector('.form-panel');
            const periodFilter = document.getElementById('geral-period-filter');
            const actionCells = geralTab.querySelectorAll('.data-table th:last-child, .data-table td:last-child');
            
            const originalExportBtnDisplay = exportGeralPdfBtn.style.display;
            exportGeralPdfBtn.style.display = 'none';
            if (periodFilter) periodFilter.style.display = 'none';
            if (formPanel) formPanel.style.display = 'none';
            actionCells.forEach(el => el.style.display = 'none');

            const originalWidth = geralTab.style.width;
            geralTab.style.width = '1100px';
            geralTab.classList.add('pdf-export');

            const originalBtnText = exportGeralPdfBtn.innerHTML;
            exportGeralPdfBtn.style.display = 'none'; 

            const opt = {
                margin:       0.3,
                filename:     `relatorio-geral-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, backgroundColor: '#ffffff' },
                jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
            };

            html2pdf().set(opt).from(geralTab).save().then(() => {
                exportGeralPdfBtn.style.display = originalExportBtnDisplay;
                exportGeralPdfBtn.innerHTML = originalBtnText;
                if (periodFilter) periodFilter.style.display = '';
                if (formPanel) formPanel.style.display = '';
                actionCells.forEach(el => el.style.display = '');
                geralTab.style.width = originalWidth;
                geralTab.classList.remove('pdf-export');
            });
        });
    }

    if(geralForm) {
        geralForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tipo = document.getElementById('g-tipo').value;
            const descricao = document.getElementById('g-descricao').value;
            const valor = parseFloat(document.getElementById('g-valor').value);
            const status = document.getElementById('g-status').value;
            const dateInput = document.getElementById('g-data').value;

            const submitBtn = geralForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Salvando...';
            submitBtn.disabled = true;

            const { data, error } = await supabase
                .from('general_transactions')
                .insert([
                    { date: dateInput, tipo, descricao, valor, status }
                ])
                .select();

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if (!error && data) {
                geralTransactions.unshift(data[0]);
                geralForm.reset();
                document.getElementById('g-data').valueAsDate = new Date();
                document.getElementById('g-tipo').value = 'receita';
                
                updateGeralSummary();
                renderGeralTable();
            } else {
                alert('Erro ao salvar transação: ' + error.message);
                console.error(error);
            }
        });
    }

    window.deletarGeral = async (id) => {
        if(confirm('Tem certeza que deseja deletar esta transação?')) {
            const { error } = await supabase
                .from('general_transactions')
                .delete()
                .eq('id', id);

            if (!error) {
                geralTransactions = geralTransactions.filter(t => t.id !== id);
                updateGeralSummary();
                renderGeralTable();
            } else {
                alert('Erro ao deletar: ' + error.message);
            }
        }
    };

    window.marcarGeralPago = async (id) => {
        const { data, error } = await supabase
            .from('general_transactions')
            .update({ status: 'pago' })
            .eq('id', id)
            .select();

        if (!error && data) {
            const index = geralTransactions.findIndex(t => t.id === id);
            if(index !== -1) {
                geralTransactions[index].status = 'pago';
                renderGeralTable();
            }
        } else {
            alert('Erro ao atualizar: ' + error.message);
        }
    };

    // ==== Emprestimos Logic ====
    const emprestimoForm = document.getElementById('emprestimo-form');
    const emprestimosTbody = document.getElementById('emprestimos-tbody');
    const eDataInput = document.getElementById('e-data');
    if (eDataInput) eDataInput.valueAsDate = new Date();

    const updateEmprestimosSummary = () => {
        let pendentes = 0;
        let devolvidos = 0;

        emprestimosTransactions.forEach(t => {
            if(t.status === 'pendente') {
                pendentes += parseFloat(t.valor);
            } else if (t.status === 'devolvido') {
                devolvidos += parseFloat(t.valor);
            }
        });

        const elPendentes = document.getElementById('emprestimos-pendentes');
        const elDevolvidos = document.getElementById('emprestimos-devolvidos');

        if(elPendentes) elPendentes.textContent = formatCurrency(pendentes);
        if(elDevolvidos) elDevolvidos.textContent = formatCurrency(devolvidos);
    };

    const renderEmprestimosTable = () => {
        if(!emprestimosTbody) return;
        emprestimosTbody.innerHTML = '';

        if (emprestimosTransactions.length === 0) {
            emprestimosTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-secondary);">Nenhum empréstimo registrado.</td></tr>`;
            return;
        }

        emprestimosTransactions.forEach(t => {
            const tr = document.createElement('tr');
            
            let dateStr = t.date;
            if(t.date) {
                const d = new Date(t.date);
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                dateStr = d.toLocaleDateString('pt-BR');
            }

            const statusClass = t.status === 'devolvido' ? 'status-pago' : 'status-pendente';
            const statusText = t.status === 'devolvido' ? 'DEVOLVIDO' : 'AGUARDANDO';

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><strong>${t.nome}</strong><br><span style="font-size: 12px; color: var(--text-secondary);">${t.descricao}</span></td>
                <td><strong>${formatCurrency(t.valor)}</strong></td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="action-btns">
                    ${t.status === 'pendente' ? `<button class="btn btn-sm btn-success" onclick="marcarEmprestimoBaixado('${t.id}')" title="Dar Baixa (Devolvido)"><i class="ph ph-check"></i> Baixar</button>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="deletarEmprestimo('${t.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                </td>
            `;
            emprestimosTbody.appendChild(tr);
        });
    };

    if(emprestimoForm) {
        emprestimoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nome = document.getElementById('e-nome').value;
            const descricao = document.getElementById('e-descricao').value;
            const valor = parseFloat(document.getElementById('e-valor').value);
            const dateInput = document.getElementById('e-data').value;
            const status = 'pendente';

            const submitBtn = emprestimoForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Registrando...';
            submitBtn.disabled = true;

            const { data, error } = await supabase
                .from('loans')
                .insert([
                    { date: dateInput, nome, descricao, valor, status }
                ])
                .select();

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if (!error && data) {
                emprestimosTransactions.unshift(data[0]);
                emprestimoForm.reset();
                document.getElementById('e-data').valueAsDate = new Date();
                
                updateEmprestimosSummary();
                renderEmprestimosTable();
            } else {
                alert('Erro ao salvar empréstimo: ' + error.message);
                console.error(error);
            }
        });
    }

    window.deletarEmprestimo = async (id) => {
        if(confirm('Tem certeza que deseja deletar este empréstimo?')) {
            const { error } = await supabase
                .from('loans')
                .delete()
                .eq('id', id);

            if (!error) {
                emprestimosTransactions = emprestimosTransactions.filter(t => t.id !== id);
                updateEmprestimosSummary();
                renderEmprestimosTable();
            } else {
                alert('Erro ao deletar: ' + error.message);
            }
        }
    };

    window.marcarEmprestimoBaixado = async (id) => {
        if(confirm('Confirmar a devolução deste dinheiro?')) {
            const { data, error } = await supabase
                .from('loans')
                .update({ status: 'devolvido' })
                .eq('id', id)
                .select();

            if (!error && data) {
                const index = emprestimosTransactions.findIndex(t => t.id === id);
                if(index !== -1) {
                    emprestimosTransactions[index].status = 'devolvido';
                    updateEmprestimosSummary();
                    renderEmprestimosTable();
                }
            } else {
                alert('Erro ao dar baixa: ' + error.message);
            }
        }
    };

    // Initialize fetching data
    loadData();
});
