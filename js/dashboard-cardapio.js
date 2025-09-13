// js/dashboard-cardapio.js

// Importando as funções necessárias do Cloud Firestore
import { firestore } from './firebase-config.js';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Função auxiliar para formatar moeda
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// --- ESTADO GLOBAL DO MÓDULO ---
let allProducts = []; // Armazena todos os produtos carregados para filtragem rápida na UI

// --- SELETORES DO DOM ---
const productForm = document.getElementById('product-form');
const categorySelect = document.getElementById('product-category');
const ingredientsGroup = document.getElementById('product-ingredients-group');
const formTitle = document.getElementById('form-title');
const productIdInput = document.getElementById('product-id');
const clearFormBtn = document.getElementById('clear-form-btn');
// Seletores da Visão GRID
const gridViewContainer = document.getElementById('grid-view-container');
const productListItems = document.getElementById('product-list-items');
const gridFilters = document.getElementById('grid-filters');
// Seletores da Visão PLANILHA
const tableViewContainer = document.getElementById('table-view-container');
const productTableBody = document.getElementById('product-table-body');
const tableFilters = document.getElementById('table-filters');
const tableSearchInput = document.getElementById('table-search-input');
const tableRotationHint = document.getElementById('table-rotation-hint');
// Seletor de Visualização
const viewSwitcher = document.querySelector('.view-switcher');

// ===============================================
// --- FUNÇÕES DE RENDERIZAÇÃO ---
// ===============================================

const renderGridView = (products) => {
    productListItems.innerHTML = '';
    if (!products || products.length === 0) {
        productListItems.innerHTML = '<p>Nenhum produto encontrado.</p>'; return;
    }
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card-admin';
        // Usamos o spread operator para garantir que todos os dados, incluindo o ID, estejam no dataset
        Object.entries({ ...product }).forEach(([key, value]) => { card.dataset[key] = value; });
        card.innerHTML = `
            <img src="${product.imagemUrl || 'img/desenho-pizza.png'}" alt="${product.nome}">
            <div class="product-info-admin"><h4>${product.nome}</h4><span>${formatCurrency(product.preco)}</span></div>
            <div class="product-actions-admin"><button class="btn-icon edit-btn" title="Editar"><i class="material-icons">edit</i></button><button class="btn-icon delete-btn" title="Excluir"><i class="material-icons">delete</i></button></div>
        `;
        productListItems.appendChild(card);
    });
};

const renderTableView = (products) => {
    productTableBody.innerHTML = '';
    if (!products || products.length === 0) {
        productTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum produto encontrado.</td></tr>'; return;
    }
    products.forEach(product => {
        const row = document.createElement('tr');
        Object.entries({ ...product }).forEach(([key, value]) => { row.dataset[key] = value; });
        row.innerHTML = `
            <td title="${product.nome}">${product.nome}</td>
            <td>${product.categoria}</td>
            <td>${formatCurrency(product.preco)}</td>
            <td>
                <div class="product-actions-admin">
                    <button class="btn-icon edit-btn" title="Editar produto"><i class="material-icons">edit</i></button>
                    <button class="btn-icon delete-btn" title="Excluir produto"><i class="material-icons">delete</i></button>
                </div>
            </td>
        `;
        productTableBody.appendChild(row);
    });
};

// ===============================================
// --- FUNÇÕES DE FILTRAGEM ---
// ===============================================

const applyFilters = () => {
    // Filtros para a Visão GRID
    const activeGridCategory = gridFilters.querySelector('.filter-btn.active').dataset.category;
    const gridProducts = (activeGridCategory === 'all') ? allProducts : allProducts.filter(p => p.categoria === activeGridCategory);
    renderGridView(gridProducts);

    // Filtros para a Visão PLANILHA
    const activeTableCategory = tableFilters.querySelector('.filter-btn.active').dataset.category;
    const searchTerm = tableSearchInput.value.toLowerCase();
    let tableProducts = allProducts;
    if (activeTableCategory !== 'all') {
        tableProducts = tableProducts.filter(p => p.categoria === activeTableCategory);
    }
    if (searchTerm) {
        tableProducts = tableProducts.filter(p => p.nome.toLowerCase().includes(searchTerm));
    }
    renderTableView(tableProducts);
};

// ===============================================
// --- LÓGICA DE DADOS (FIREBASE FIRESTORE) ---
// ===============================================

const fetchProducts = async () => {
    productListItems.innerHTML = '<p>Carregando...</p>';
    productTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando...</td></tr>';
    try {
        // Busca os documentos da coleção 'produtos' no Firestore
        const querySnapshot = await getDocs(collection(firestore, 'produtos'));
        // Mapeia os documentos para um array de objetos, incluindo o ID de cada documento
        allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => a.nome.localeCompare(b.nome)); // Ordena por nome
        
        applyFilters(); // Renderiza os produtos na UI
    } catch (error) {
        console.error("Erro ao buscar produtos no Firestore: ", error);
        productListItems.innerHTML = '<p>Erro ao carregar produtos.</p>';
        productTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Erro ao carregar produtos.</td></tr>';
    }
};

const resetForm = () => { 
    productForm.reset(); 
    productIdInput.value = ''; 
    formTitle.textContent = 'Adicionar Novo Produto'; 
    ingredientsGroup.style.display = 'block'; 
};

// ===============================================
// --- INICIALIZAÇÃO E EVENT LISTENERS ---
// ===============================================

export function init() {
    // --- LÓGICA DO FORMULÁRIO (CRIAR E ATUALIZAR) ---
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true; 
        submitButton.textContent = 'Salvando...';
        
        // A categoria agora faz parte do objeto de dados do produto
        const productData = { 
            nome: document.getElementById('product-name').value, 
            imagemUrl: document.getElementById('product-image').value, 
            ingredientes: document.getElementById('product-ingredients').value, 
            preco: parseFloat(document.getElementById('product-price').value),
            categoria: document.getElementById('product-category').value
        };

        if (productData.categoria === 'bebida') {
            productData.ingredientes = ''; // Ingredientes não são necessários para bebidas
        }

        try {
            const id = productIdInput.value;
            if (id) { 
                // Se existe um ID, atualiza o documento existente no Firestore
                await updateDoc(doc(firestore, 'produtos', id), productData); 
                alert('Produto atualizado com sucesso!'); 
            } else { 
                // Se não há ID, adiciona um novo documento à coleção 'produtos'
                await addDoc(collection(firestore, 'produtos'), productData); 
                alert('Produto criado com sucesso!'); 
            }
            resetForm(); 
            await fetchProducts(); // Recarrega a lista para mostrar as mudanças
        } catch (error) { 
            console.error("Erro ao salvar produto no Firestore: ", error); 
            alert('Ocorreu um erro ao salvar o produto.');
        } finally { 
            submitButton.disabled = false; 
            submitButton.textContent = 'Salvar'; 
        }
    });
    
    // --- LÓGICA DE AÇÕES (EDITAR/EXCLUIR) USANDO DELEGAÇÃO DE EVENTOS ---
    const handleActionClick = async (e) => {
        const parentElement = e.target.closest('.product-card-admin, tr');
        if (!parentElement) return;

        const { id } = parentElement.dataset; // Pega o ID do dataset do elemento

        // Ação de Editar
        if (e.target.closest('.edit-btn')) {
            const data = parentElement.dataset;
            productIdInput.value = data.id; 
            document.getElementById('product-name').value = data.nome; 
            document.getElementById('product-image').value = data.imagemurl; 
            document.getElementById('product-ingredients').value = data.ingredientes; 
            document.getElementById('product-category').value = data.categoria; 
            document.getElementById('product-price').value = data.preco; 
            formTitle.textContent = 'Editar Produto'; 
            categorySelect.dispatchEvent(new Event('change')); 
            window.scrollTo(0, 0); // Rola a página para o topo
        }

        // Ação de Excluir
        if (e.target.closest('.delete-btn')) {
            if (confirm('Tem certeza que deseja excluir este produto?')) {
                try { 
                    // Deleta o documento do Firestore usando seu ID
                    await deleteDoc(doc(firestore, 'produtos', id));
                    parentElement.remove(); // Remove o elemento da UI instantaneamente
                    alert('Produto excluído com sucesso!'); 
                    // Atualiza o array local para refletir a exclusão
                    allProducts = allProducts.filter(p => p.id !== id); 
                    applyFilters();
                } catch (error) { 
                    console.error("Erro ao excluir produto do Firestore: ", error); 
                    alert('Ocorreu um erro ao excluir o produto.'); 
                }
            }
        }
    };
    productListItems.addEventListener('click', handleActionClick);
    productTableBody.addEventListener('click', handleActionClick);

    // --- LÓGICA DOS FILTROS, BUSCA E SELETOR DE VISUALIZAÇÃO ---
    const handleFilterClick = () => applyFilters();
    gridFilters.addEventListener('click', (e) => { if (e.target.matches('.filter-btn')) { gridFilters.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); handleFilterClick(); } });
    tableFilters.addEventListener('click', (e) => { if (e.target.matches('.filter-btn')) { tableFilters.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); handleFilterClick(); } });
    tableSearchInput.addEventListener('input', handleFilterClick);
    
    const checkRotationHint = () => { 
        const isTableView = tableViewContainer.classList.contains('active'); 
        const isMobileVertical = window.innerWidth < 800; 
        tableRotationHint.style.display = (isTableView && isMobileVertical) ? 'flex' : 'none'; 
    };
    
    viewSwitcher.addEventListener('click', (e) => { 
        const viewBtn = e.target.closest('.view-btn'); 
        if (!viewBtn) return; 
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active')); 
        viewBtn.classList.add('active'); 
        const isGrid = viewBtn.dataset.view === 'grid'; 
        gridViewContainer.classList.toggle('active', isGrid); 
        tableViewContainer.classList.toggle('active', !isGrid); 
        checkRotationHint(); 
    });
    
    window.addEventListener('resize', checkRotationHint);
    
    // --- OUTROS EVENTOS ---
    clearFormBtn.addEventListener('click', resetForm);
    categorySelect.addEventListener('change', () => { 
        ingredientsGroup.style.display = (categorySelect.value === 'bebida') ? 'none' : 'block'; 
    });

    // --- CARGA INICIAL ---
    fetchProducts();
}