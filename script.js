let selectedMonths = new Set(); 
let composicaoChartInstance = null; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa data de cálculo (já preenchido no HTML)

    // 2. Event Listeners para Meses Clicáveis (Opcional: o usuário pode ajustar a seleção)
    document.querySelectorAll('.month-item').forEach(monthItem => {
        monthItem.addEventListener('click', () => {
            const month = parseInt(monthItem.dataset.month);
            if (selectedMonths.has(month)) {
                selectedMonths.delete(month);
            } else {
                selectedMonths.add(month);
            }
            // Recalcula ao mudar a seleção manual de meses para atualizar resultados
            updateMonthsGrid();
            calcularDecimoTerceiro(false); // Passa 'false' para não forçar a inferência novamente
        });
    });

    // 3. Event Listeners para Botões
    document.getElementById('calcularBtn').addEventListener('click', () => calcularDecimoTerceiro(true)); // Passa 'true' para forçar a inferência
    document.getElementById('limparBtn').addEventListener('click', limparCampos);
    // NOVO: Usa a função nativa de impressão
    document.getElementById('imprimirBtn').addEventListener('click', imprimirResultado); 

    // 4. Exemplo de cálculo inicial (opcional, apenas para carregar a tela como na imagem)
    calcularDecimoTerceiro(true);
});

/**
 * Função principal de cálculo.
 * @param {boolean} forceInferMonths - Se verdadeiro, a seleção de meses é redefinida com base nas datas.
 */
function calcularDecimoTerceiro(forceInferMonths) {
    // 1. Coleta de dados da interface
    const nomeFuncionario = document.getElementById('nomeFuncionario').value;
    const salarioBrutoMensal = parseFloat(document.getElementById('salarioBruto').value.replace(',', '.'));
    const dataAdmissaoStr = document.getElementById('dataAdmissao').value;
    const dataCalculoStr = document.getElementById('dataCalculo').value;
    const parcelaTipo = document.getElementById('parcela').value;
    const deduzirInss = document.getElementById('deduzirInss').value === 'sim';
    const deduzirIrrf = document.getElementById('deduzirIrrf').value === 'sim'; 

    // Validação
    if (isNaN(salarioBrutoMensal) || salarioBrutoMensal <= 0 || !dataAdmissaoStr || !dataCalculoStr) {
        // Se já está sendo exibido, limpa. Se for o primeiro cálculo, apenas retorna.
        if (document.getElementById('detailedResultados').style.display !== 'none') {
             limparCampos();
        }
        return;
    }
    
    // PONTO 1: Coloração automática dos meses
    let mesesTrabalhados = 0;
    
    if (forceInferMonths) {
        mesesTrabalhados = inferirMesesTrabalhados(dataAdmissaoStr, dataCalculoStr);
        // Atualiza o set de meses e a visualização
        selectedMonths.clear();
        for (let i = 1; i <= mesesTrabalhados; i++) {
            selectedMonths.add(i);
        }
        updateMonthsGrid(); 
    } else {
        // Se não for forçado, usa o que foi selecionado manualmente
        mesesTrabalhados = selectedMonths.size;
    }
    
    if (mesesTrabalhados === 0) {
        document.getElementById('detailedResultados').style.display = 'none';
        document.getElementById('imprimirBtn').style.display = 'none';
        alert("Nenhum mês trabalhado foi contabilizado.");
        return;
    }

    // VARIÁVEIS DE CÁLCULO
    const decimoTerceiroBrutoTotal = (salarioBrutoMensal / 12) * mesesTrabalhados;
    let valorINSS = 0;
    let valorIRRF = 0;
    let valorLiquidoReceber = 0;
    let valorAdiantadoPrimeiraParcela = 0;
    let baseCalculoFinal = decimoTerceiroBrutoTotal; 
    const steps = []; 


    // 2. Detalhamento e Cálculo (Passos)
    steps.push({
        title: "Cálculo do Décimo Terceiro Proporcional",
        description: `Décimo Terceiro Proporcional = (Salário Mensal / 12) * Meses Trabalhados`,
        formula: `R$ ${formatarNumero(salarioBrutoMensal)} / 12 * ${mesesTrabalhados} = ${formatarMoeda(decimoTerceiroBrutoTotal)}`,
        value: decimoTerceiroBrutoTotal
    });
    
    steps.push({
        title: `${parcelaTipo === 'primeira' ? 'Primeira Parcela (Adiantamento)' : 'Parcela Integral - 100% do valor'}`,
        description: `Valor ${parcelaTipo === 'primeira' ? 'bruto' : 'integral'}: ${formatarMoeda(decimoTerceiroBrutoTotal)}`,
        value: decimoTerceiroBrutoTotal
    });


    if (parcelaTipo === 'primeira') {
        valorAdiantadoPrimeiraParcela = decimoTerceiroBrutoTotal / 2;
        valorLiquidoReceber = valorAdiantadoPrimeiraParcela; 
        
        steps[1].title = "Primeira Parcela (Adiantamento - 50%)";
        steps[1].description = `50% do valor bruto: ${formatarMoeda(valorAdiantadoPrimeiraParcela)}\nNão há desconto de INSS/IRRF na primeira parcela.`;
        steps[1].value = valorAdiantadoPrimeiraParcela;

    } else if (parcelaTipo === 'segunda' || parcelaTipo === 'integral') {
        
        // Base de cálculo para descontos é o valor integral
        let baseDesconto = decimoTerceiroBrutoTotal;

        // 3. CÁLCULO DO INSS (Usando Tabela 2025)
        if (deduzirInss) {
            const inssCalculado = calcularINSS(baseDesconto); 
            valorINSS = inssCalculado;
            baseCalculoFinal -= valorINSS;
            steps.push({
                title: "Cálculo Detalhado do INSS",
                description: `Tabela INSS 2025 - Cálculo Progressivo:\nBase de cálculo: ${formatarMoeda(baseDesconto)}\n${getINSSCalculationDetails(baseDesconto)}`,
                value: valorINSS,
                isDeduction: true
            });
        }
        
        // 4. CÁLCULO DO IRRF
        if (deduzirIrrf) {
            // IRRF é calculado sobre (Total Bruto - INSS)
            const irrfCalculado = calcularIRRF(baseDesconto, valorINSS); 
            valorIRRF = irrfCalculado;
            baseCalculoFinal -= valorIRRF;
            steps.push({
                title: "Cálculo Detalhado do IRRF",
                description: `Tabela IRRF 2024 (Ajustar para 2025 se necessário):\nBase de cálculo (após INSS): ${formatarMoeda(baseDesconto - valorINSS)}\n${getIRRFCalculationDetails(baseDesconto - valorINSS)}`,
                value: valorIRRF,
                isDeduction: true
            });
        }
        
        if (parcelaTipo === 'segunda') {
            valorAdiantadoPrimeiraParcela = decimoTerceiroBrutoTotal / 2;
            baseCalculoFinal -= valorAdiantadoPrimeiraParcela;
            steps.push({
                title: "Desconto da Primeira Parcela Adiantada",
                description: `Valor total líquido (${formatarMoeda(decimoTerceiroBrutoTotal - valorINSS - valorIRRF)}) - Primeira Parcela Bruta Adiantada (${formatarMoeda(valorAdiantadoPrimeiraParcela)})`,
                value: valorAdiantadoPrimeiraParcela,
                isDeduction: true
            });
        }

        valorLiquidoReceber = baseCalculoFinal;
    }

    // 5. Exibição dos resultados
    renderDetailedResults(salarioBrutoMensal, mesesTrabalhados, decimoTerceiroBrutoTotal, valorINSS, valorIRRF, valorLiquidoReceber, steps);
    document.getElementById('imprimirBtn').style.display = 'inline-block';
    document.getElementById('detailedResultados').style.display = 'grid'; 
}

function inferirMesesTrabalhados(dataAdmissaoStr, dataCalculoStr) {
    // Note: Usamos "T00:00:00" para evitar problemas de fuso horário que podem mudar o dia.
    const dataAdmissao = new Date(dataAdmissaoStr + "T00:00:00"); 
    const dataCalculo = new Date(dataCalculoStr + "T00:00:00");

    const anoAdmissao = dataAdmissao.getFullYear();
    const mesAdmissao = dataAdmissao.getMonth(); // 0 (Jan) a 11 (Dez)
    const diaAdmissao = dataAdmissao.getDate();

    const anoCalculo = dataCalculo.getFullYear();
    const mesCalculo = dataCalculo.getMonth(); 

    if (anoAdmissao > anoCalculo) {
        // Validação básica
        return 0;
    }
    
    let mesesTrabalhados = 0;

    if (anoAdmissao === anoCalculo) {
        // Meses completos + o mês de admissão se o dia for <= 15
        mesesTrabalhados = mesCalculo - mesAdmissao + (diaAdmissao <= 15 ? 1 : 0);
        mesesTrabalhados = Math.min(mesesTrabalhados, 12);
    } else { // Admissão em anos anteriores
        // Contabiliza todos os meses até o mês de cálculo, inclusive.
        mesesTrabalhados = mesCalculo + 1; 
        mesesTrabalhados = Math.min(mesesTrabalhados, 12);
    }
    return Math.max(0, mesesTrabalhados);
}

function updateMonthsGrid() {
    document.querySelectorAll('.month-item').forEach(monthItem => {
        const month = parseInt(monthItem.dataset.month);
        if (selectedMonths.has(month)) {
            monthItem.classList.add('active');
        } else {
            monthItem.classList.remove('active');
        }
    });
}

function renderDetailedResults(salario, meses, brutoTotal, inss, irrf, liquido, steps) {
    // Renderiza Resumo no topo
    const summaryDetailsDiv = document.getElementById('summaryDetails');
    summaryDetailsDiv.innerHTML = `
        <p>Salário Base: <span>${formatarMoeda(salario)}</span></p>
        <p>Meses Trabalhados: <span>${meses} meses</span></p>
        <p>Décimo Terceiro Proporcional: <span>${formatarMoeda(brutoTotal)}</span></p>
        <p>Desconto INSS: <span>${formatarMoeda(inss)}</span></p>
        <p>Desconto IRRF: <span>${formatarMoeda(irrf)}</span></p>
    `;
    
    // Atualiza o valor final no box principal
    document.getElementById('finalValueDisplay').textContent = formatarMoeda(liquido);

    // Renderiza Detalhamento de Passos
    const calculationStepsDiv = document.getElementById('calculationSteps');
    calculationStepsDiv.innerHTML = '';
    steps.forEach((step, index) => {
        const stepDiv = document.createElement('div');
        stepDiv.classList.add('calculation-step');
        stepDiv.innerHTML = `
            <div class="step-number">${index + 1}</div>
            <h4>${step.title}</h4>
            <pre>${step.description}</pre>
            <p style="font-weight: 500;">Valor ${step.isDeduction ? 'após desconto' : 'integral'}: <span class="value">${formatarMoeda(step.value)}</span></p>
        `;
        calculationStepsDiv.appendChild(stepDiv);
    });
    document.getElementById('finalValueDisplayStep').textContent = formatarMoeda(liquido);


    // Renderizar Gráfico
    renderComposicaoChart(liquido, inss + irrf); 
}

function renderComposicaoChart(valorLiquido, valorDescontos) {
    const ctx = document.getElementById('composicaoChart').getContext('2d');
    if (composicaoChartInstance) {
        composicaoChartInstance.destroy();
    }

    const total = valorLiquido + valorDescontos;
    const percentLiquido = total > 0 ? (valorLiquido / total * 100).toFixed(1) : 0;
    const percentDescontos = total > 0 ? (valorDescontos / total * 100).toFixed(1) : 0;
    
    let backgroundColors = ['#28a745', '#dc3545'];
    if (total === 0) {
        backgroundColors = ['#e0e0e0', '#e0e0e0'];
    }

    composicaoChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Valor Líquido', 'Descontos (INSS + IRRF)'],
            datasets: [{
                data: [valorLiquido, valorDescontos],
                backgroundColor: backgroundColors,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += formatarMoeda(context.parsed) + ` (${(context.parsed / total * 100).toFixed(1)}%)`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    // Renderiza a legenda customizada
    const chartLegendDiv = document.getElementById('chartLegend');
    chartLegendDiv.innerHTML = `
        <div class="chart-legend-item">
            <span class="chart-legend-color" style="background-color: #28a745;"></span>
            Valor Líquido: ${formatarMoeda(valorLiquido)} (${percentLiquido}%)
        </div>
        <div class="chart-legend-item">
            <span class="chart-legend-color" style="background-color: #dc3545;"></span>
            Descontos INSS + IRRF: ${formatarMoeda(valorDescontos)} (${percentDescontos}%)
        </div>
    `;
}


function limparCampos() {
    document.getElementById('nomeFuncionario').value = '';
    document.getElementById('salarioBruto').value = '0.00';
    document.getElementById('dataAdmissao').value = '';

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('dataCalculo').value = `${year}-${month}-${day}`;

    document.getElementById('parcela').value = 'integral';
    document.getElementById('deduzirInss').value = 'sim';
    document.getElementById('deduzirIrrf').value = 'sim'; 
    
    selectedMonths.clear();
    updateMonthsGrid();

    document.getElementById('detailedResultados').style.display = 'none';
    document.getElementById('imprimirBtn').style.display = 'none'; // Novo ID
    
    if (composicaoChartInstance) {
        composicaoChartInstance.destroy();
        composicaoChartInstance = null;
    }
    document.getElementById('chartLegend').innerHTML = ''; 
}

// PONTO 2: Novo nome da função de impressão
function imprimirResultado() {
    // Oculta botões para a impressão (o CSS @media print faz a maior parte)
    const buttonGroup = document.querySelector('.button-group');
    const originalDisplay = buttonGroup.style.display;
    buttonGroup.style.display = 'none'; 
    
    // Chama a caixa de diálogo de impressão do navegador
    window.print();
    
    // Restaura os botões
    setTimeout(() => {
        buttonGroup.style.display = originalDisplay; 
    }, 500); 
}

/**
 * FUNÇÕES DE CÁLCULO E DETALHAMENTO DE IMPOSTOS
 * ATENÇÃO: AGORA USANDO A TABELA INSS 2025 FORNECIDA NA IMAGEM.
 */

// Tabela INSS 2025 (Baseado na imagem)
function calcularINSS(baseSalarial) {
    let inss = 0;
    
    // Limites da Tabela INSS 2025 (baseado na imagem)
    const f1_limite = 1518.00;
    const f2_limite = 2793.88;
    const f3_limite = 4190.83;
    const f4_limite = 8157.41; // Teto

    // Faixa 1 (7.5%)
    if (baseSalarial <= f1_limite) { 
        inss = baseSalarial * 0.075;
    } else {
        // Valor máximo da Faixa 1
        inss += f1_limite * 0.075; 
        
        // Faixa 2 (9%)
        if (baseSalarial <= f2_limite) {
            inss += (baseSalarial - f1_limite) * 0.09;
        } else {
            // Valor máximo da Faixa 2
            inss += (f2_limite - f1_limite) * 0.09; 

            // Faixa 3 (12%)
            if (baseSalarial <= f3_limite) {
                inss += (baseSalarial - f2_limite) * 0.12;
            } else {
                // Valor máximo da Faixa 3
                inss += (f3_limite - f2_limite) * 0.12; 
                
                // Faixa 4 (14%)
                if (baseSalarial <= f4_limite) {
                    inss += (baseSalarial - f3_limite) * 0.14;
                } else {
                    // Teto (Apenas o valor que ultrapassa o limite da F3, até o teto da F4)
                    inss += (f4_limite - f3_limite) * 0.14; 
                }
            }
        }
    }
    // Retorna o INSS calculado ou o valor máximo, garantindo precisão de duas casas.
    return parseFloat(inss.toFixed(2)); 
}

function getINSSCalculationDetails(baseSalarial) {
    let details = "Tabela INSS 2025 - Cálculo Progressivo:\n";
    let inssParcial = 0;
    
    // Limites da Tabela INSS 2025 (baseado na imagem)
    const f1 = 1518.00;
    const f2 = 2793.88;
    const f3 = 4190.83;
    const f4 = 8157.41; // Teto

    const inssFinal = calcularINSS(baseSalarial); // Calcula o valor final usando a função correta
    let valorAcumulado = 0;

    // --- Faixa 1 (7.5%) ---
    const v1 = Math.min(baseSalarial, f1);
    const c1 = v1 * 0.075;
    valorAcumulado += c1;
    details += `Faixa 1: Até R$ ${formatarNumero(f1)} - 7.5%\nR$ ${formatarNumero(v1)} * 7.5% = R$ ${formatarNumero(c1)}\n`;

    // --- Faixa 2 (9%) ---
    if (baseSalarial > f1) {
        const baseCalculoF2 = Math.min(baseSalarial, f2) - f1;
        const c2 = baseCalculoF2 * 0.09;
        valorAcumulado += c2;
        details += `Faixa 2: De R$ ${formatarNumero(f1 + 0.01)} até R$ ${formatarNumero(f2)} - 9%\nR$ ${formatarNumero(baseCalculoF2)} * 9% = R$ ${formatarNumero(c2)}\n`;
    }

    // --- Faixa 3 (12%) ---
    if (baseSalarial > f2) {
        const baseCalculoF3 = Math.min(baseSalarial, f3) - f2;
        const c3 = baseCalculoF3 * 0.12;
        valorAcumulado += c3;
        details += `Faixa 3: De R$ ${formatarNumero(f2 + 0.01)} até R$ ${formatarNumero(f3)} - 12%\nR$ ${formatarNumero(baseCalculoF3)} * 12% = R$ ${formatarNumero(c3)}\n`;
    }

    // --- Faixa 4 (14%) ---
    if (baseSalarial > f3) {
        const baseCalculoF4 = Math.min(baseSalarial, f4) - f3;
        const c4 = baseCalculoF4 * 0.14;
        valorAcumulado += c4;
        
        details += `Faixa 4: De R$ ${formatarNumero(f3 + 0.01)} até R$ ${formatarNumero(f4)} - 14%\nR$ ${formatarNumero(baseCalculoF4)} * 14% = R$ ${formatarNumero(c4)}\n`;
    }
    
    // Total e Valor após desconto
    details += `Total INSS: R$ ${formatarNumero(inssFinal)}\n`;
    
    const valorAposDesconto = baseSalarial - inssFinal;
    details += `Valor após desconto: R$ ${formatarNumero(baseSalarial)} - R$ ${formatarNumero(inssFinal)} = R$ ${formatarNumero(valorAposDesconto)}`;
    return details;
}


// Tabela IRRF 2024 (Exemplo) - MANTIDA A ÚLTIMA VERSÃO
function calcularIRRF(baseSalarialCompleta, descontoINSS) {
    const baseCalculoIR = baseSalarialCompleta - descontoINSS;
    let aliquota = 0;
    let parcelaADeduzir = 0;

    // Tabela IRRF 2024 (Exemplo)
    if (baseCalculoIR <= 2112.00) {
        return 0; // Isento
    } else if (baseCalculoIR <= 2826.65) {
        aliquota = 0.075;
        parcelaADeduzir = 158.40;
    } else if (baseCalculoIR <= 3751.05) {
        aliquota = 0.15;
        parcelaADeduzir = 370.40;
    } else if (baseCalculoIR <= 4664.68) {
        aliquota = 0.225;
        parcelaADeduzir = 651.73;
    } else {
        aliquota = 0.275;
        parcelaADeduzir = 884.96;
    }

    const irrfCalculado = (baseCalculoIR * aliquota) - parcelaADeduzir;
    return parseFloat(Math.max(0, irrfCalculado).toFixed(2));
}

function getIRRFCalculationDetails(baseCalculoIR) {
    let details = "";
    let aliquota = 0;
    let parcelaADeduzir = 0;
    let faixa = "Isento";
    const valorAposDesconto = baseCalculoIR; // Renomeado para clareza

    if (valorAposDesconto <= 2112.00) {
        details += `Base de Cálculo: ${formatarMoeda(valorAposDesconto)}\nIsento (até R$ 2.112,00)`;
        return details;
    } else if (valorAposDesconto <= 2826.65) {
        faixa = "Faixa 1"; aliquota = 0.075; parcelaADeduzir = 158.40;
    } else if (valorAposDesconto <= 3751.05) {
        faixa = "Faixa 2"; aliquota = 0.15; parcelaADeduzir = 370.40;
    } else if (valorAposDesconto <= 4664.68) {
        faixa = "Faixa 3"; aliquota = 0.225; parcelaADeduzir = 651.73;
    } else {
        faixa = "Faixa 4"; aliquota = 0.275; parcelaADeduzir = 884.96;
    }

    const irrfBruto = valorAposDesconto * aliquota;
    const irrfFinal = irrfBruto - parcelaADeduzir;

    details += `Base de Cálculo: ${formatarMoeda(valorAposDesconto)}\n`;
    details += `${faixa}: Alíquota de ${aliquota * 100}% com parcela a deduzir de R$ ${formatarNumero(parcelaADeduzir)}\n`;
    details += `Cálculo: (R$ ${formatarNumero(valorAposDesconto)} * ${aliquota * 100}%) - R$ ${formatarNumero(parcelaADeduzir)}\n`;
    details += `Total IRRF: R$ ${formatarNumero(Math.max(0, irrfFinal))}`;
    return details;
}

// Funções utilitárias de formatação
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarNumero(valor) {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}