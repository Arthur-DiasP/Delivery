// server.js
import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv'; // 1. IMPORTA O PACOTE DOTENV

dotenv.config(); // 2. EXECUTA A CONFIGURAÇÃO PARA CARREGAR O ARQUIVO .ENV

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// 3. LÊ A CHAVE DE API A PARTIR DAS VARIÁVEIS DE AMBIENTE CARREGADAS
const ASAAS_API_KEY = process.env.ASAAS_API_KEY; 
const ASAAS_URL = 'https://www.asaas.com/api/v3';

// Verifica se a chave de API foi carregada corretamente
if (!ASAAS_API_KEY) {
  console.error("ERRO CRÍTICO: A variável de ambiente ASAAS_API_KEY não foi encontrada.");
  console.error("Verifique se você criou um arquivo .env na raiz do projeto com o conteúdo: ASAAS_API_KEY=sua_chave_aqui");
  process.exit(1); // Encerra o servidor se a chave não existir
}

const asaasAPI = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return fetch(`${ASAAS_URL}${endpoint}`, options);
};

app.post('/api/create-payment', async (req, res) => {
  try {
    const { userData, addressData, total, paymentMethod, cardData } = req.body;

    if (!userData || !userData.nome || !userData.email || !userData.cpf) {
      return res.status(400).json({ error: 'Dados do usuário incompletos.' });
    }

    const cleanCpf = userData.cpf.replace(/\D/g, '');
    let customerId;
    const findCustomerResponse = await asaasAPI(`/customers?cpfCnpj=${cleanCpf}`);
    const findCustomerData = await findCustomerResponse.json();

    if (findCustomerData.data && findCustomerData.data.length > 0) {
      customerId = findCustomerData.data[0].id;
    } else {
      const customerPayload = {
        name: userData.nome,
        email: userData.email,
        cpfCnpj: cleanCpf,
        phone: userData.telefone.replace(/\D/g, ''),
        postalCode: addressData.cep.replace(/\D/g, ''),
        address: addressData.rua,
        addressNumber: addressData.numero,
        complement: addressData.complemento,
        district: addressData.bairro,
      };
      const createCustomerResponse = await asaasAPI('/customers', 'POST', customerPayload);
      const createCustomerData = await createCustomerResponse.json();
      if (!createCustomerResponse.ok) {
        return res.status(400).json({ error: 'Erro ao criar cliente', details: createCustomerData.errors });
      }
      customerId = createCustomerData.id;
    }

    const paymentPayload = {
      customer: customerId,
      billingType: paymentMethod.toUpperCase(),
      value: total,
      dueDate: new Date().toISOString().split('T')[0],
      description: `Pedido na Pizzaria Moraes para ${userData.nome}`,
    };

    if (paymentMethod.toUpperCase().includes('CARD')) {
      if (!cardData) return res.status(400).json({ error: 'Dados do cartão não fornecidos.' });
      paymentPayload.creditCard = {
        holderName: cardData.name,
        number: cardData.number.replace(/\s/g, ''),
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        ccv: cardData.cvv
      };
      paymentPayload.creditCardHolderInfo = {
        name: userData.nome,
        email: userData.email,
        cpfCnpj: cleanCpf,
        postalCode: addressData.cep.replace(/\D/g, ''),
        addressNumber: addressData.numero,
        phone: userData.telefone.replace(/\D/g, '')
      };
    }

    const paymentResponse = await asaasAPI('/payments', 'POST', paymentPayload);
    const paymentData = await paymentResponse.json();

    console.log('RESPOSTA INICIAL DA CRIAÇÃO:', JSON.stringify(paymentData, null, 2));

    if (!paymentResponse.ok) {
      console.error('Erro da API Asaas ao criar pagamento:', paymentData);
      return res.status(400).json({ error: 'Erro ao criar pagamento', details: paymentData.errors });
    }
    
    if (paymentData.billingType === 'PIX' && paymentData.id) {
      console.log(`Pagamento PIX criado com ID: ${paymentData.id}. Buscando detalhes e QR Code...`);
      const getQrCodeResponse = await asaasAPI(`/payments/${paymentData.id}/pixQrCode`);
      const qrCodeData = await getQrCodeResponse.json();
      
      console.log('RESPOSTA DA BUSCA PELO QR CODE:', JSON.stringify(qrCodeData, null, 2));
      
      if (!getQrCodeResponse.ok) {
          return res.status(400).json({ error: 'Pagamento criado, mas falha ao obter QR Code', details: qrCodeData.errors });
      }

      const fullPaymentData = { ...paymentData, pixQrCode: qrCodeData };
      return res.json(fullPaymentData);
    }
    
    res.json(paymentData);

  } catch (error) {
    console.error('Erro interno no servidor:', error);
    res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Aguardando requisições do frontend em http://localhost:${PORT}`);
});