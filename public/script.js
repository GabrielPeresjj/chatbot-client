// public/script.js
document.addEventListener('DOMContentLoaded', function() {
    const chatbox = document.getElementById('chatbox');
    chatbox.scrollTop = chatbox.scrollHeight;
  
    const form = document.getElementById('chat-form');
    form.addEventListener('submit', function() {
      setTimeout(function() {
        chatbox.scrollTop = chatbox.scrollHeight;
      }, 100);
    });
  });
  