// js/dashboard-cupom.js

import { firestore } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- SELETORES DO DOM ---
const form = document.getElementById('cupom-campaign-form');
const formTitle = document.getElementById('cupom-form-title');
const campaignIdInput = document.getElementById('campaign-id');
const clearFormBtn = document.getElementById('clear-campaign-form-btn');
const tableBody = document.getElementById('campaigns-table-body');

// --- ESTADO LOCAL ---
let allCampaigns = [];

/**
 * Busca todas as campanhas do Firestore e renderiza na tabela.
 */
const fetchAndRenderCampaigns = async () => {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Carregando campanhas...</td></tr>';
    try {
        const querySnapshot = await getDocs(collection(firestore, 'cupons'));
        allCampaigns = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Ordena por data de início, da mais nova para a mais antiga
        allCampaigns.sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));
        
        renderTable();
    } catch (error) {
        console.error("Erro ao buscar campanhas:", error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;" class="error-message">Falha ao carregar campanhas.</td></tr>';
    }
};

/**
 * Renderiza os dados das campanhas na tabela.
 */
const renderTable = () => {
    tableBody.innerHTML = '';
    if (allCampaigns.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma campanha criada ainda.</td></tr>';
        return;
    }

    allCampaigns.forEach(campaign => {
        const tr = document.createElement('tr');
        tr.dataset.id = campaign.id;

        const startDate = new Date(campaign.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR');
        const endDate = new Date(campaign.dataFim + 'T00:00:00').toLocaleDateString('pt-BR');
        
        const statusClass = campaign.ativa ? 'status-concluído' : 'status-cancelado';
        const statusText = campaign.ativa ? 'Ativa' : 'Inativa';

        tr.innerHTML = `
            <td>
                <strong>${campaign.nome}</strong><br>
                <small>${campaign.desconto}% OFF</small>
            </td>
            <td>${startDate} a ${endDate}</td>
            <td>
                Tentativas: ${campaign.tentativas}<br>
                Chances: ${campaign.chances}
            </td>
            <td><span class="order-status ${statusClass}">${statusText}</span></td>
            <td>
                <div class="product-actions-admin">
                    <button class="btn-icon edit-btn" title="Editar Campanha"><i class="material-icons">edit</i></button>
                    <button class="btn-icon delete-btn" title="Excluir Campanha"><i class="material-icons">delete</i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
};

/**
 * Limpa o formulário e reseta seu estado.
 */
const resetForm = () => {
    form.reset();
    campaignIdInput.value = '';
    formTitle.textContent = 'Criar Campanha de Cupom';
    document.getElementById('campaign-status').value = 'true';
};

/**
 * Preenche o formulário com dados de uma campanha para edição.
 * @param {string} id - O ID da campanha a ser editada.
 */
const populateFormForEdit = (id) => {
    const campaign = allCampaigns.find(c => c.id === id);
    if (!campaign) return;

    campaignIdInput.value = id;
    formTitle.textContent = 'Editar Campanha';
    document.getElementById('campaign-name').value = campaign.nome;
    document.getElementById('campaign-description').value = campaign.descricao;
    document.getElementById('campaign-discount').value = campaign.desconto;
    document.getElementById('campaign-startDate').value = campaign.dataInicio;
    document.getElementById('campaign-endDate').value = campaign.dataFim;
    document.getElementById('campaign-attempts').value = campaign.tentativas;
    document.getElementById('campaign-chances').value = campaign.chances;
    document.getElementById('campaign-status').value = campaign.ativa.toString();

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * Função de inicialização do módulo.
 */
export function init() {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = campaignIdInput.value;

        const campaignData = {
            nome: document.getElementById('campaign-name').value,
            descricao: document.getElementById('campaign-description').value,
            desconto: parseInt(document.getElementById('campaign-discount').value, 10),
            dataInicio: document.getElementById('campaign-startDate').value,
            dataFim: document.getElementById('campaign-endDate').value,
            tentativas: parseInt(document.getElementById('campaign-attempts').value, 10),
            chances: parseInt(document.getElementById('campaign-chances').value, 10),
            ativa: document.getElementById('campaign-status').value === 'true',
        };

        if (new Date(campaignData.dataFim) < new Date(campaignData.dataInicio)) {
            alert("A data de fim não pode ser anterior à data de início.");
            return;
        }

        try {
            if (id) {
                await updateDoc(doc(firestore, 'cupons', id), campaignData);
                alert('Campanha atualizada com sucesso!');
            } else {
                await addDoc(collection(firestore, 'cupons'), campaignData);
                alert('Campanha criada com sucesso!');
            }
            resetForm();
            await fetchAndRenderCampaigns();
        } catch (error) {
            console.error("Erro ao salvar campanha:", error);
            alert("Ocorreu um erro ao salvar a campanha.");
        }
    });

    tableBody.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const id = row.dataset.id;

        if (e.target.closest('.edit-btn')) {
            populateFormForEdit(id);
        }

        if (e.target.closest('.delete-btn')) {
            if (confirm('Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.')) {
                try {
                    await deleteDoc(doc(firestore, 'cupons', id));
                    alert('Campanha excluída com sucesso.');
                    await fetchAndRenderCampaigns();
                } catch (error) {
                    console.error("Erro ao excluir campanha:", error);
                    alert("Ocorreu um erro ao excluir a campanha.");
                }
            }
        }
    });

    clearFormBtn.addEventListener('click', resetForm);
    fetchAndRenderCampaigns();
}