# Projeto de Registo de Satisfação

Aplicação web para registo e análise de satisfação de clientes.

## Tecnologias Utilizadas

*   **Frontend:** HTML5, CSS3, JavaScript
*   **Backend:** JavaScript com Firebase
*   **Base de Dados:** Firebase Firestore
*   **Autenticação:** Firebase Authentication (email/password)
*   **Gráficos:** Chart.js
*   **Versionamento:** GitHub
*   **Deploy:** Firebase Hosting

## Instruções para Correr Localmente

1.  Clone o repositório.
2.  Crie um projeto no [Firebase](https://console.firebase.google.com/).
3.  Nas configurações do seu projeto Firebase, adicione uma nova aplicação web.
4.  Copie as credenciais do Firebase (firebaseConfig) para o ficheiro `public/js/firebase-config.js`.
5.  Ative o Firebase Authentication (Email/Password) e crie um utilizador para a área de administração.
6.  Ative o Firebase Firestore.
7.  Para testar localmente, pode usar um servidor web simples. Se tiver o Python instalado, pode executar na raiz do projeto:
    `python -m http.server 8000`
    A aplicação estará disponível em `http://localhost:8000`.

## Instruções de Deploy no Firebase

1.  Instale o Firebase CLI:
    `npm install -g firebase-tools`
2.  Faça login na sua conta Google:
    `firebase login`
3.  Inicialize o Firebase no seu projeto (selecione "Hosting"):
    `firebase init`
    *   Selecione o projeto Firebase que criou.
    *   Indique `public` como a sua pasta pública.
    *   Configure como uma "single-page app": **No**.
    *   Não substitua o `index.html`.
4.  Faça o deploy da aplicação:
    `firebase deploy`

A aplicação será publicada e estará acessível através do URL fornecido pelo Firebase.
