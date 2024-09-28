// app.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const validator = require('validator');
const { cnpj } = require('cpf-cnpj-validator');
const sanitizeHtml = require('sanitize-html');
const { salvarDadosUsuario } = require('./data');

const app = express();
const port = 3000;

// Configurar o EJS como motor de templates
app.set('view engine', 'ejs');

// Middleware para servir arquivos estáticos
app.use(express.static('public'));

// Middleware para analisar o corpo das requisições
app.use(bodyParser.urlencoded({ extended: false }));

// Configurar a sessão
app.use(session({
  secret: 'seu-segredo-aqui', // Substitua por um segredo seguro em produção
  resave: false,
  saveUninitialized: true,
}));

// Funções auxiliares
function isPositiveResponse(response) {
  const positiveWords = ['sim', 'está correto', 'estão corretas', 'certo', 'isso mesmo', 'confirmo', 'correto', 'claro', 'ok', 'perfeito'];
  response = response.toLowerCase();
  return positiveWords.some(word => response.includes(word));
}

function isNegativeResponse(response) {
  const negativeWords = ['não', 'nao', 'precisa corrigir', 'errado', 'incorreto', 'não está correto', 'nao esta correto', 'incorreta', 'errada'];
  response = response.toLowerCase();
  return negativeWords.some(word => response.includes(word));
}

// Rota GET para a página inicial
app.get('/', (req, res) => {
  // Inicializar mensagens na sessão
  if (!req.session.mensagens) {
    req.session.mensagens = [
      {
        role: 'assistant',
        content: 'Olá! Tudo bem? Eu sou o assistente virtual da empresa XYZ e estou aqui para ajudá-lo a agendar um contato. Como posso chamá-lo?'
      }
    ];
    req.session.etapa = 'nome_completo';
    req.session.dadosUsuario = {};
  }
  res.render('index', { mensagens: req.session.mensagens });
});

// Rota POST para processar as mensagens
app.post('/', async (req, res) => {
  // Sanitizar a entrada do usuário
  const mensagemUsuario = sanitizeHtml(req.body.mensagem, {
    allowedTags: [],
    allowedAttributes: {}
  });

  // Adicionar a mensagem do usuário
  req.session.mensagens.push({ role: 'user', content: mensagemUsuario });

  try {
    // Processar a mensagem do usuário com base na etapa atual
    const etapaAtual = req.session.etapa;

    if (etapaAtual === 'nome_completo') {
      req.session.dadosUsuario.nome_completo = mensagemUsuario;
      req.session.mensagens.push({ role: 'assistant', content: `Prazer em conhecê-lo, ${sanitizeHtml(mensagemUsuario)}! Poderia me fornecer seu CNPJ?` });
      req.session.etapa = 'cnpj';
    } else if (etapaAtual === 'cnpj') {
      const cnpjInput = mensagemUsuario.replace(/\D/g, '');
      if (cnpj.isValid(cnpjInput)) {
        req.session.dadosUsuario.cnpj = cnpjInput;
        req.session.mensagens.push({ role: 'assistant', content: 'Perfeito! Qual é o seu número de telefone com DDD?' });
        req.session.etapa = 'telefone';
      } else {
        req.session.mensagens.push({ role: 'assistant', content: 'Por favor, insira um CNPJ válido.' });
      }
    } else if (etapaAtual === 'telefone') {
      const telefone = mensagemUsuario.replace(/\D/g, '');
      // Verificar se o telefone possui DDD e 10 ou 11 dígitos
      if (/^\d{10,11}$/.test(telefone)) {
        req.session.dadosUsuario.telefone = mensagemUsuario;
        req.session.mensagens.push({ role: 'assistant', content: 'Obrigado. Poderia me informar seu e-mail?' });
        req.session.etapa = 'email';
      } else {
        req.session.mensagens.push({ role: 'assistant', content: 'Por favor, insira um número de telefone válido com DDD (10 ou 11 dígitos).' });
      }
    } else if (etapaAtual === 'email') {
      if (validator.isEmail(mensagemUsuario)) {
        req.session.dadosUsuario.email = mensagemUsuario;
        req.session.mensagens.push({ role: 'assistant', content: 'Você prefere que entremos em contato por WhatsApp ou ligação?' });
        req.session.etapa = 'meio_de_contato';
      } else {
        req.session.mensagens.push({ role: 'assistant', content: 'Por favor, insira um endereço de e-mail válido.' });
      }
    } else if (etapaAtual === 'meio_de_contato') {
      const preferencia = mensagemUsuario.toLowerCase();
      if (preferencia.includes('whatsapp') || preferencia.includes('ligação') || preferencia.includes('telefonema') || preferencia.includes('telefone')) {
        req.session.dadosUsuario.meio_de_contato = preferencia.includes('whatsapp') ? 'WhatsApp' : 'Ligação';
        req.session.mensagens.push({ role: 'assistant', content: 'Qual é o melhor horário para entrarmos em contato com você? (manhã, tarde ou noite)' });
        req.session.etapa = 'periodo';
      } else {
        req.session.mensagens.push({ role: 'assistant', content: 'Desculpe, não entendi. Você prefere WhatsApp ou ligação?' });
      }
    } else if (etapaAtual === 'periodo') {
      const periodo = mensagemUsuario.toLowerCase();
      if (['manhã', 'tarde', 'noite'].includes(periodo)) {
        req.session.dadosUsuario.periodo = periodo;
        // Apresentar as informações coletadas para confirmação com formatação
        const dados = req.session.dadosUsuario;
        req.session.mensagens.push({
          role: 'assistant',
          content: `Obrigado! Antes de prosseguirmos, por favor, confirme se as informações estão corretas:<br><br>` +
            `<b>Nome completo:</b> ${sanitizeHtml(dados.nome_completo)}<br>` +
            `<b>CNPJ:</b> ${dados.cnpj}<br>` +
            `<b>Telefone:</b> ${sanitizeHtml(dados.telefone)}<br>` +
            `<b>E-mail:</b> ${sanitizeHtml(dados.email)}<br>` +
            `<b>Meio de contato:</b> ${sanitizeHtml(dados.meio_de_contato)}<br>` +
            `<b>Horário preferencial:</b> ${sanitizeHtml(dados.periodo)}<br><br>` +
            `Estão corretas? (Responda "sim" ou "não")`
        });
        req.session.etapa = 'confirmacao';
      } else {
        req.session.mensagens.push({ role: 'assistant', content: 'Por favor, informe se o melhor horário é "manhã", "tarde" ou "noite".' });
      }
    } else if (etapaAtual === 'confirmacao') {
      const resposta = mensagemUsuario.toLowerCase();

      if (isPositiveResponse(resposta)) {
        // Salvar os dados
        await salvarDadosUsuario(req.session.dadosUsuario);
        req.session.mensagens.push({ role: 'assistant', content: 'Ótimo! Suas informações foram registradas com sucesso. Entraremos em contato em breve. Tenha um excelente dia!' });

        // Fazer uma cópia das mensagens antes de destruir a sessão
        const mensagens = req.session.mensagens;

        // Limpar a sessão completamente
        req.session.destroy((err) => {
          if (err) {
            console.error('Erro ao destruir a sessão:', err);
          }
          // Renderizar a página com as mensagens
          res.render('index', { mensagens });
        });
        return; // Sair da função para evitar chamar res.render novamente
      } else if (isNegativeResponse(resposta)) {
        req.session.mensagens.push({ role: 'assistant', content: 'Desculpe pelo equívoco. Qual informação gostaria de corrigir? (nome completo, CNPJ, telefone, e-mail, meio de contato, ou horário)' });
        req.session.etapa = 'correcao_campo';
      } else {
        req.session.mensagens.push({ role: 'assistant', content: 'Desculpe, não consegui entender. Por favor, responda "sim" se as informações estiverem corretas ou "não" se precisar corrigir algo.' });
      }
    } else if (etapaAtual === 'correcao_campo') {
      const campo = mensagemUsuario.toLowerCase();
      if (['nome completo', 'cnpj', 'telefone', 'e-mail', 'email', 'meio de contato', 'horário', 'horario'].includes(campo)) {
        req.session.campoParaCorrigir = campo;
        req.session.mensagens.push({ role: 'assistant', content: `Por favor, informe o ${campo} correto.` });
        req.session.etapa = 'correcao_valor';
      } else {
        req.session.mensagens.push({ role: 'assistant', content: 'Desculpe, não identifiquei esse campo. Por favor, indique qual informação gostaria de corrigir.' });
      }
    } else if (etapaAtual === 'correcao_valor') {
      const campo = req.session.campoParaCorrigir;
      let valorCorreto = sanitizeHtml(mensagemUsuario, {
        allowedTags: [],
        allowedAttributes: {}
      });
      let erro = false;

      if (campo.includes('nome completo')) {
        req.session.dadosUsuario.nome_completo = valorCorreto;
      } else if (campo.includes('cnpj')) {
        const cnpjInput = valorCorreto.replace(/\D/g, '');
        if (cnpj.isValid(cnpjInput)) {
          req.session.dadosUsuario.cnpj = cnpjInput;
        } else {
          req.session.mensagens.push({ role: 'assistant', content: 'Por favor, insira um CNPJ válido.' });
          erro = true;
        }
      } else if (campo.includes('telefone')) {
        const telefone = valorCorreto.replace(/\D/g, '');
        if (/^\d{10,11}$/.test(telefone)) {
          req.session.dadosUsuario.telefone = valorCorreto;
        } else {
          req.session.mensagens.push({ role: 'assistant', content: 'Por favor, insira um número de telefone válido com DDD (10 ou 11 dígitos).' });
          erro = true;
        }
      } else if (campo.includes('e-mail') || campo.includes('email')) {
        if (validator.isEmail(valorCorreto)) {
          req.session.dadosUsuario.email = valorCorreto;
        } else {
          req.session.mensagens.push({ role: 'assistant', content: 'Por favor, insira um endereço de e-mail válido.' });
          erro = true;
        }
      } else if (campo.includes('meio de contato')) {
        const preferencia = valorCorreto.toLowerCase();
        if (preferencia.includes('whatsapp') || preferencia.includes('ligação') || preferencia.includes('telefonema') || preferencia.includes('telefone')) {
          req.session.dadosUsuario.meio_de_contato = preferencia.includes('whatsapp') ? 'WhatsApp' : 'Ligação';
        } else {
          req.session.mensagens.push({ role: 'assistant', content: 'Desculpe, não entendi. Você prefere WhatsApp ou ligação?' });
          erro = true;
        }
      } else if (campo.includes('horário') || campo.includes('horario')) {
        const periodo = valorCorreto.toLowerCase();
        if (['manhã', 'tarde', 'noite'].includes(periodo)) {
          req.session.dadosUsuario.periodo = periodo;
        } else {
          req.session.mensagens.push({ role: 'assistant', content: 'Por favor, informe se o melhor horário é "manhã", "tarde" ou "noite".' });
          erro = true;
        }
      }

      if (!erro) {
        // Apresentar novamente as informações para confirmação com formatação
        const dados = req.session.dadosUsuario;
        req.session.mensagens.push({
          role: 'assistant',
          content: `Obrigado pela correção. Por favor, confirme se as informações estão corretas agora:<br><br>` +
            `<b>Nome completo:</b> ${sanitizeHtml(dados.nome_completo)}<br>` +
            `<b>CNPJ:</b> ${dados.cnpj}<br>` +
            `<b>Telefone:</b> ${sanitizeHtml(dados.telefone)}<br>` +
            `<b>E-mail:</b> ${sanitizeHtml(dados.email)}<br>` +
            `<b>Meio de contato:</b> ${sanitizeHtml(dados.meio_de_contato)}<br>` +
            `<b>Horário preferencial:</b> ${sanitizeHtml(dados.periodo)}<br><br>` +
            `Estão corretas? (Responda "sim" ou "não")`
        });
        req.session.etapa = 'confirmacao';
      }
    }

  } catch (error) {
    console.error("Erro ao processar a mensagem:", error);
    req.session.mensagens.push({ role: 'assistant', content: 'Desculpe, ocorreu um erro ao processar sua mensagem.' });
  }

  // Renderizar a página com as mensagens atualizadas
  res.render('index', { mensagens: req.session.mensagens });
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
