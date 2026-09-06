

(() => {

"use strict";

/* =========================================================
   API CONFIGURATION
========================================================= */

/*
 * LEFT EXPOSED INTENTIONALLY FOR YOUR CURRENT TESTING.
 *
 * You can move this to your backend later.
 */

const API_ENDPOINT =
  "https://exegesis-api.onrender.com/v1/chat/completions";

const API_KEY =
  "ex-bHmEzi4LYWzISU23nrxvsLc1tOa1m4ytSz-VAuEJ25k";

const API_SETTINGS_URL =
  "YOUR_API_SETTINGS_LINK_HERE";

/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEY =
  "exegesis_chats_v2";

const CONFIG_KEY =
  "exegesis_api_config_v2";

/* =========================================================
   EXEGESIS IDENTITY
========================================================= */

const EXEGESIS_SYSTEM_PROMPT = `
You are Exegesis Version 1, an AI assistant.

Your identity is:

Name: Exegesis
Version: Version 1

If a user asks questions such as:

"Who are you?"
"What are you?"
"What model are you?"
"Which AI are you?"
"Are you ChatGPT?"
"Are you Gemini?"
"Are you Claude?"
"Are you DeepSeek?"
"What version are you?"
"Tell me about yourself."

identify yourself clearly as:

"I am Exegesis Version 1, an AI assistant."

Do not claim to be ChatGPT, Gemini, Claude, DeepSeek, Llama, or another AI assistant.

If the user asks about the underlying model or provider powering Exegesis,
be honest and distinguish between the Exegesis assistant identity and
the underlying model/provider.

Do not invent capabilities that are not actually available.

You should be helpful, accurate, professional, clear, and honest.

When answering normal questions, focus directly on the user's request.
`;

/* =========================================================
   DEFAULT CONFIG
========================================================= */

const DEFAULT_CONFIG = {
  endpoint: API_ENDPOINT,
  apiKey: API_KEY,
  model: ""
};

/* =========================================================
   HELPERS
========================================================= */

const $ = (id) =>
  document.getElementById(id);

const stream =
  $("stream");

const streamInner =
  $("streamInner");

const input =
  $("input");

const sendBtn =
  $("sendBtn");

const micBtn =
  $("micBtn");

const toast =
  $("toast");

const app =
  $("app");

marked.setOptions({
  gfm:true,
  breaks:false
});

/* =========================================================
   LOCAL STORAGE
========================================================= */

function loadJSON(key,fallback){

  try{

    const value =
      localStorage.getItem(key);

    return value
      ? JSON.parse(value)
      : fallback;

  }catch{

    return fallback;

  }

}

function saveJSON(key,value){

  try{

    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

    return true;

  }catch{

    return false;

  }

}

/* =========================================================
   STATE
========================================================= */

let state =
  loadJSON(
    STORAGE_KEY,
    {
      chats:{},
      order:[],
      activeId:null
    }
  );

let config =
  Object.assign(
    {},
    DEFAULT_CONFIG,
    loadJSON(
      CONFIG_KEY,
      {}
    )
  );

let isSending = false;

let abortController = null;

let toastTimer = null;

let isRecording = false;

let recognition = null;

/* =========================================================
   TOAST
========================================================= */

function showToast(
  msg,
  kind=""
){

  toast.textContent =
    msg;

  toast.className =
    "toast show " + kind;

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(
      () => {
        toast.className =
          "toast";
      },
      3200
    );

}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  s=""
){

  return s.replace(
    /[&<>"']/g,
    c =>
      ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#039;"
      }[c])
  );

}

/* =========================================================
   ACTIVE CHAT
========================================================= */

function activeChat(){

  return state.activeId
    ? state.chats[state.activeId]
    : null;

}

/* =========================================================
   SAVE STATE
========================================================= */

function saveState(){

  saveJSON(
    STORAGE_KEY,
    state
  );

}

/* =========================================================
   CREATE NEW CHAT
========================================================= */

function newChat(){

  const id =
    "c_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2,7);

  state.chats[id] = {

    id,

    title:"New chat",

    messages:[],

    createdAt:
      Date.now(),

    updatedAt:
      Date.now()

  };

  state.order.unshift(id);

  state.activeId =
    id;

  saveState();

  renderAll();

  focusInput();

}

/* =========================================================
   ADD MESSAGE
========================================================= */

function addMessage(
  chatId,
  role,
  content
){

  const c =
    state.chats[chatId];

  if(!c)return null;

  const m = {

    role,

    content,

    time:
      Date.now()

  };

  c.messages.push(m);

  c.updatedAt =
    Date.now();

  if(
    role==="user" &&
    c.title==="New chat"
  ){

    c.title =
      content.length > 46
        ? content.slice(0,46).trim()+"…"
        : content;

  }

  saveState();

  return m;

}

/* =========================================================
   DELETE CHAT
========================================================= */

function deleteChat(id){

  if(
    !confirm(
      "Delete this chat?"
    )
  )return;

  delete state.chats[id];

  state.order =
    state.order.filter(
      x => x !== id
    );

  if(
    state.activeId === id
  ){

    state.activeId =
      state.order[0] || null;

  }

  saveState();

  /*
   * If there are no chats left,
   * show the clean welcome screen.
   */
  renderAll();

}

/* =========================================================
   MARKDOWN
========================================================= */

function renderMarkdown(md){

  return DOMPurify.sanitize(
    marked.parse(md || "")
  );

}

/* =========================================================
   CODE BLOCK DECORATION
========================================================= */

function decorateCodeBlocks(root){

  root
    .querySelectorAll(
      "pre > code"
    )
    .forEach(code => {

      if(
        code.closest(
          ".code-block"
        )
      )return;

      try{

        hljs.highlightElement(
          code
        );

      }catch{}

      const pre =
        code.parentElement;

      const wrap =
        document.createElement(
          "div"
        );

      const head =
        document.createElement(
          "div"
        );

      wrap.className =
        "code-block";

      head.className =
        "code-head";

      const lang =
        (
          code.className.match(
            /language-([\w-]+)/
          ) || []
        )[1] || "code";

      head.innerHTML =
        "<span>" +
        escapeHtml(lang) +
        "</span>";

      const btn =
        document.createElement(
          "button"
        );

      btn.className =
        "code-copy";

      btn.textContent =
        "Copy";

      btn.onclick =
        async () => {

          try{

            await navigator.clipboard.writeText(
              code.textContent
            );

            btn.textContent =
              "Copied";

            setTimeout(
              () => {
                btn.textContent =
                  "Copy";
              },
              1200
            );

          }catch{

            showToast(
              "Could not copy code.",
              "error"
            );

          }

        };

      head.appendChild(btn);

      pre.parentNode.insertBefore(
        wrap,
        pre
      );

      wrap.append(
        head,
        pre
      );

    });

}

/* =========================================================
   MESSAGE ROW
========================================================= */

function messageRow(
  role,
  content,
  ts
){

  const row =
    document.createElement(
      "div"
    );

  row.className =
    "msg-row " + role;

  /* ASSISTANT AVATAR */

  if(
    role==="assistant"
  ){

    const av =
      document.createElement(
        "div"
      );

    av.className =
      "avatar";

    av.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#07110d" stroke-width="2.2">' +
      '<path d="M12 2a7 7 0 0 0-7 7c0 3 2 4.5 2 7a5 5 0 0 0 10 0c0-2.5 2-4 2-7a7 7 0 0 0-7-7z"/>' +
      '</svg>';

    row.appendChild(av);

  }

  /* BUBBLE */

  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "bubble";

  const body =
    document.createElement(
      "div"
    );

  if(
    role==="user"
  ){

    body.innerHTML =
      "<p>" +
      escapeHtml(content) +
      "</p>";

  }else{

    body.innerHTML =
      renderMarkdown(
        content
      );

  }

  bubble.appendChild(body);

  /* MESSAGE CONTROLS */

  const meta =
    document.createElement(
      "div"
    );

  meta.className =
    "msg-meta";

  const cp =
    document.createElement(
      "button"
    );

  cp.className =
    "copy-msg";

  cp.textContent =
    "Copy";

  cp.onclick =
    async () => {

      try{

        /*
         * Copy original content.
         * This preserves Markdown and code.
         */
        await navigator.clipboard.writeText(
          content || ""
        );

        cp.textContent =
          "Copied";

        setTimeout(
          () => {
            cp.textContent =
              "Copy";
          },
          1200
        );

      }catch{

        showToast(
          "Could not copy the message.",
          "error"
        );

      }

    };

  meta.appendChild(cp);

  if(ts){

    const t =
      document.createElement(
        "span"
      );

    t.className =
      "msg-time";

    t.textContent =
      new Date(ts)
        .toLocaleTimeString(
          [],
          {
            hour:"2-digit",
            minute:"2-digit"
          }
        );

    meta.appendChild(t);

  }

  bubble.appendChild(
    meta
  );

  if(
    role==="assistant"
  ){

    decorateCodeBlocks(
      bubble
    );

  }

  row.appendChild(
    bubble
  );

  return row;

}

/* =========================================================
   WELCOME SCREEN
========================================================= */

function renderWelcome(){

  streamInner.innerHTML = `

    <div class="welcome">

      <div class="welcome-mark">

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#07110d"
          stroke-width="2.2"
        >
          <path d="M12 2a7 7 0 0 0-7 7c0 3 2 4.5 2 7a5 5 0 0 0 10 0c0-2.5 2-4 2-7a7 7 0 0 0-7-7z"/>
        </svg>

      </div>

      <h1>
        How can I help?
      </h1>

      <p>
        Ask questions, write code, plan ideas,
        summarize information, or work through
        a problem with Exegesis.
      </p>

      <div class="suggestions">

        <button
          class="suggestion"
          data-q="I'd like help explaining a concept. What would you like me to explain?"
        >
          <b>Explain a concept</b>
          Clear step-by-step explanations
        </button>

        <button
          class="suggestion"
          data-q="I'd like help writing code. What would you like me to code?"
        >
          <b>Write code</b>
          Generate and debug code
        </button>

        <button
          class="suggestion"
          data-q="I'd like help creating a plan. What would you like to plan?"
        >
          <b>Plan something</b>
          Turn goals into a clear plan
        </button>

        <button
          class="suggestion"
          data-q="I'd like help with professional writing. What would you like me to write?"
        >
          <b>Write professionally</b>
          Emails, notes and drafts
        </button>

      </div>

    </div>

  `;

  streamInner
    .querySelectorAll(
      ".suggestion"
    )
    .forEach(b => {

      b.onclick = () => {

        input.value =
          b.dataset.q;

        autosize();

        updateSend();

        handleSend();

      };

    });

}

/* =========================================================
   RENDER MESSAGES
========================================================= */

function renderMessages(){

  const c =
    activeChat();

  $("topbarChatName").textContent =
    c &&
    c.title !== "New chat"
      ? "— " + c.title
      : "";

  /*
   * No active chat OR empty chat:
   * always display the welcome page.
   */
  if(
    !c ||
    !c.messages ||
    !c.messages.length
  ){

    renderWelcome();

    return;

  }

  streamInner.innerHTML =
    "";

  c.messages.forEach(
    m => {

      streamInner.appendChild(
        messageRow(
          m.role,
          m.content,
          m.time
        )
      );

    }
  );

  scrollToBottom(false);

}

/* =========================================================
   RENDER SIDEBAR
========================================================= */

function renderSidebar(){

  const q =
    $("searchInput")
      .value
      .trim()
      .toLowerCase();

  $("chatList").innerHTML =
    "";

  const ids =
    state.order.filter(
      id =>
        state.chats[id] &&
        (
          !q ||
          state.chats[id]
            .title
            .toLowerCase()
            .includes(q)
        )
    );

  if(!ids.length){

    $("chatList").innerHTML =
      '<div class="chat-label">' +
      (
        q
          ? "No matching chats"
          : "No chats yet"
      ) +
      "</div>";

    return;

  }

  const lab =
    document.createElement(
      "div"
    );

  lab.className =
    "chat-label";

  lab.textContent =
    "Chats";

  $("chatList")
    .appendChild(lab);

  ids.forEach(
    id => {

      const c =
        state.chats[id];

      const el =
        document.createElement(
          "div"
        );

      el.className =
        "chat-item" +
        (
          id === state.activeId
            ? " active"
            : ""
        );

      el.innerHTML =
        '<span class="chat-title">' +
        escapeHtml(c.title) +
        '</span>' +
        '<button class="chat-delete" title="Delete">×</button>';

      el.onclick =
        e => {

          if(
            e.target.closest(
              ".chat-delete"
            )
          )return;

          state.activeId =
            id;

          saveState();

          renderAll();

          if(
            innerWidth <= 820
          ){

            app.classList.remove(
              "sidebar-open"
            );

          }

        };

      el
        .querySelector(
          ".chat-delete"
        )
        .onclick =
        e => {

          e.stopPropagation();

          deleteChat(id);

        };

      $("chatList")
        .appendChild(el);

    }
  );

}

/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll(){

  renderSidebar();

  renderMessages();

}

/* =========================================================
   SCROLL
========================================================= */

function scrollToBottom(
  smooth=true
){

  requestAnimationFrame(
    () => {

      stream.scrollTo({
        top:
          stream.scrollHeight,

        behavior:
          smooth
            ? "smooth"
            : "auto"
      });

    }
  );

}

/* =========================================================
   AUTO SIZE INPUT
========================================================= */

function autosize(){

  /*
   * Reset first so the textarea can shrink
   * when text is deleted.
   */

  input.style.height =
    "auto";

  const maxHeight =
    180;

  const newHeight =
    Math.min(
      input.scrollHeight,
      maxHeight
    );

  input.style.height =
    newHeight + "px";

  /*
   * Only activate internal scrolling
   * after the maximum height is reached.
   */

  if(
    input.scrollHeight >
    maxHeight
  ){

    input.classList.add(
      "is-scrollable"
    );

  }else{

    input.classList.remove(
      "is-scrollable"
    );

  }

}

/* =========================================================
   UPDATE SEND BUTTON
   -------- ADDED THIS MISSING FUNCTION ----------
========================================================= */

function updateSend() {
  const text = input.value.trim();
  sendBtn.disabled = !text || isSending;
}

/* =========================================================
   FOCUS INPUT
========================================================= */

function focusInput(){

  setTimeout(
    () => input.focus(),
    30
  );

}

/* =========================================================
   NORMALIZE ENDPOINT
========================================================= */

function normalizeEndpoint(
  url
){

  url =
    (url || "")
      .trim()
      .replace(/\/+$/,"");

  if(!url)return "";

  if(
    /\/v1$/i.test(url)
  ){

    return (
      url +
      "/chat/completions"
    );

  }

  return url;

}

/* =========================================================
   API STATUS
========================================================= */

function updateApiStatus(
  kind,
  text
){

  const s =
    $("apiStatus");

  s.className =
    "status " + kind;

  $("apiStatusText")
    .textContent =
    text;

}

/* =========================================================
   REFRESH API STATUS
========================================================= */

function refreshApiStatus(){

  const ep =
    normalizeEndpoint(
      config.endpoint
    );

  if(!ep){

    updateApiStatus(
      "",
      "Configure API"
    );

  }else{

    updateApiStatus(
      "connected",
      "API configured"
    );

  }

}

/* =========================================================
   EXTRACT RESPONSE TEXT
========================================================= */

function extractText(obj){

  if(!obj)return "";

  if(
    typeof obj ===
    "string"
  ){

    return obj;

  }

  return (
    obj?.choices?.[0]?.message?.content
    ??
    obj?.choices?.[0]?.text
    ??
    obj?.output_text
    ??
    obj?.response
    ??
    obj?.message?.content
    ??
    obj?.message
    ??
    obj?.text
    ??
    obj?.content
    ??
    ""
  );

}

/* =========================================================
   EXTRACT STREAM DELTA
========================================================= */

function extractDelta(obj){

  return (
    obj?.choices?.[0]?.delta?.content
    ??
    obj?.delta?.content
    ??
    obj?.delta
    ??
    obj?.token?.text
    ??
    obj?.content
    ??
    ""
  );

}

/* =========================================================
   API CALL
========================================================= */

async function callApi(
  messages,
  onDelta,
  signal
){

  const endpoint =
    normalizeEndpoint(
      config.endpoint
    );

  if(!endpoint){

    throw new Error(
      "No API endpoint is configured."
    );

  }

  try{

    new URL(endpoint);

  }catch{

    throw new Error(
      "The API endpoint is not a valid URL."
    );

  }

  const headers = {

    "Content-Type":
      "application/json",

    "Accept":
      "text/event-stream, application/json"

  };

  if(config.apiKey){

    headers[
      "Authorization"
    ] =
      "Bearer " +
      config.apiKey;

  }

  const payload = {

    messages,

    stream:true

  };

  if(config.model){

    payload.model =
      config.model;

  }

  const response =
    await fetch(
      endpoint,
      {
        method:"POST",
        headers,
        body:
          JSON.stringify(
            payload
          ),
        signal
      }
    );

  if(!response.ok){

    let detail = "";

    try{

      detail =
        (
          await response.text()
        ).slice(0,500);

    }catch{}

    throw new Error(
      "API returned HTTP " +
      response.status +
      (
        detail
          ? ": " + detail
          : ""
      )
    );

  }

  const ct =
    (
      response.headers
        .get("content-type") ||
      ""
    ).toLowerCase();

  /* =========================
     STREAMING RESPONSE
  ========================== */

  if(
    ct.includes(
      "text/event-stream"
    ) ||
    ct.includes(
      "application/x-ndjson"
    )
  ){

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder();

    let buffer = "";

    let full = "";

    while(true){

      const {
        done,
        value
      } =
        await reader.read();

      if(done)break;

      buffer +=
        decoder.decode(
          value,
          {
            stream:true
          }
        );

      const lines =
        buffer.split(
          /\r?\n/
        );

      buffer =
        lines.pop() || "";

      for(
        const raw
        of lines
      ){

        const line =
          raw.trim();

        if(!line)continue;

        let data =
          line.startsWith(
            "data:"
          )
            ? line
                .slice(5)
                .trim()
            : line;

        if(
          data ===
          "[DONE]"
        ){

          continue;

        }

        try{

          const obj =
            JSON.parse(
              data
            );

          const d =
            extractDelta(
              obj
            );

          if(
            typeof d ===
              "string" &&
            d
          ){

            full += d;

            onDelta(d);

          }

        }catch{

          /*
           * Some providers send
           * non-JSON lines.
           * Ignore those.
           */

        }

      }

    }

    if(buffer.trim()){

      try{

        const obj =
          JSON.parse(
            buffer.replace(
              /^data:\s*/,
              ""
            )
          );

        const d =
          extractDelta(
            obj
          );

        if(d){

          full += d;

          onDelta(d);

        }

      }catch{}

    }

    return full;

  }

  /* =========================
     NORMAL JSON RESPONSE
  ========================== */

  const obj =
    await response.json();

  const text =
    extractText(obj);

  if(text){

    onDelta(
      String(text)
    );

  }

  return String(
    text || ""
  );

}

/* =========================================================
   SEND MESSAGE
========================================================= */

async function handleSend(){

  const text =
    input.value.trim();

  if(
    !text ||
    isSending
  ){

    return;

  }

  /*
   * If there is no active chat,
   * create one now.
   *
   * This is deliberately NOT done
   * when the page loads.
   */

  if(
    !state.activeId ||
    !state.chats[
      state.activeId
    ]
  ){

    newChat();

  }

  const chatId =
    state.activeId;

  addMessage(
    chatId,
    "user",
    text
  );

  renderAll();

  input.value =
    "";

  autosize();

  updateSend();

  isSending =
    true;

  updateSend();

  micBtn.disabled =
    true;

  /* =========================
     TYPING INDICATOR
  ========================== */

  const typing =
    document.createElement(
      "div"
    );

  typing.className =
    "msg-row assistant";

  typing.innerHTML = `

    <div class="avatar">

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#07110d"
        stroke-width="2.2"
      >
        <path d="M12 2a7 7 0 0 0-7 7c0 3 2 4.5 2 7a5 5 0 0 0 10 0c0-2.5 2-4 2-7a7 7 0 0 0-7-7z"/>
      </svg>

    </div>

    <div class="bubble">

      <div class="typing">
        <span></span>
        <span></span>
        <span></span>
      </div>

    </div>

  `;

  streamInner.appendChild(
    typing
  );

  scrollToBottom();

  /* =========================
     ASSISTANT MESSAGE
  ========================== */

  const c =
    state.chats[
      chatId
    ];

  const assistantMsg =
    addMessage(
      chatId,
      "assistant",
      ""
    );

  abortController =
    new AbortController();

  let row = null;

  let body = null;

  try{

    /*
     * IMPORTANT:
     *
     * The system prompt is sent
     * before the conversation.
     */

    const messages = [

      {
        role:"system",

        content:
          EXEGESIS_SYSTEM_PROMPT
      },

      ...c.messages
        .filter(
          m =>
            m !== assistantMsg
        )
        .map(
          m => ({
            role:m.role,
            content:m.content
          })
        )

    ];

    await callApi(

      messages,

      delta => {

        if(!row){

          typing.remove();

          row =
            messageRow(
              "assistant",
              "",
              assistantMsg.time
            );

          streamInner.appendChild(
            row
          );

          body =
            row.querySelector(
              ".bubble > div"
            );

        }

        assistantMsg.content +=
          delta;

        body.innerHTML =
          renderMarkdown(
            assistantMsg.content
          );

        decorateCodeBlocks(
          row.querySelector(
            ".bubble"
          )
        );

        scrollToBottom(false);

      },

      abortController.signal

    );

    if(
      !assistantMsg.content
    ){

      assistantMsg.content =
        "The API returned no text.";

    }

    if(!row){

      typing.remove();

      row =
        messageRow(
          "assistant",
          assistantMsg.content,
          assistantMsg.time
        );

      streamInner.appendChild(
        row
      );

    }

    saveState();

    renderSidebar();

    updateApiStatus(
      "connected",
      "Connected"
    );

  }catch(err){

    typing.remove();

    c.messages =
      c.messages.filter(
        m =>
          m !== assistantMsg
      );

    saveState();

    renderMessages();

    if(
      err.name ===
      "AbortError"
    ){

      showToast(
        "Response stopped."
      );

    }else{

      updateApiStatus(
        "error",
        "API error"
      );

      showToast(
        err.message ||
        "API request failed",
        "error"
      );

    }

  }finally{

    isSending =
      false;

    abortController =
      null;

    input.disabled =
      false;

    micBtn.disabled =
      false;

    updateSend();

    focusInput();

  }

}

/* =========================================================
   API SETTINGS
========================================================= */

function openApiSettings(){

  const modal =
    $("settingsModal");

  $("apiEndpoint").value =
    config.endpoint || "";

  $("apiKey").value =
    config.apiKey || "";

  $("apiModel").value =
    config.model || "";

  modal.classList.add(
    "show"
  );

}

function closeSettings(){

  $("settingsModal")
    .classList.remove(
      "show"
    );

}

function saveSettings(){

  config = {

    endpoint:
      $("apiEndpoint")
        .value
        .trim(),

    apiKey:
      $("apiKey")
        .value
        .trim(),

    model:
      $("apiModel")
        .value
        .trim()

  };

  saveJSON(
    CONFIG_KEY,
    config
  );

  closeSettings();

  refreshApiStatus();

  showToast(
    "API settings saved.",
    "success"
  );

}

/* =========================================================
   API TEST
========================================================= */

async function testApi(){

  const temp = {

    endpoint:
      $("apiEndpoint")
        .value
        .trim(),

    apiKey:
      $("apiKey")
        .value
        .trim(),

    model:
      $("apiModel")
        .value
        .trim()

  };

  const old =
    config;

  config =
    temp;

  $("testApiBtn")
    .disabled =
    true;

  $("testApiBtn")
    .textContent =
    "Testing…";

  try{

    let txt = "";

    await callApi(

      [
        {
          role:"system",
          content:
            EXEGESIS_SYSTEM_PROMPT
        },
        {
          role:"user",
          content:
            "Reply with exactly: Exegesis connected"
        }
      ],

      d => {
        txt += d;
      },

      new AbortController()
        .signal

    );

    showToast(
      txt
        ? "API connection works."
        : "Connected, but no text was returned.",
      "success"
    );

  }catch(e){

    showToast(
      e.message ||
      "Connection failed",
      "error"
    );

  }finally{

    config =
      old;

    $("testApiBtn")
      .disabled =
      false;

    $("testApiBtn")
      .textContent =
      "Test connection";

  }

}

/* =========================================================
   VOICE INPUT
========================================================= */

function setupVoice(){

  const SR =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if(!SR){

    micBtn.title =
      "Speech-to-text is not supported by this browser. Chrome/Edge work best.";

    micBtn.onclick =
      () =>
        showToast(
          "This browser does not support live speech recognition. Try Chrome or Edge, or connect a speech-to-text API.",
          "error"
        );

    return;

  }

  recognition =
    new SR();

  recognition.continuous =
    true;

  recognition.interimResults =
    true;

  recognition.lang =
    navigator.language ||
    "en-US";

  let base = "";

  recognition.onstart =
    () => {

      isRecording =
        true;

      base =
        input.value.trim();

      micBtn.classList.add(
        "recording"
      );

      micBtn.title =
        "Stop listening";

      showToast(
        "Listening…"
      );

    };

  recognition.onresult =
    e => {

      let interim = "";

      let finalText = "";

      for(
        let i=e.resultIndex;
        i<e.results.length;
        i++
      ){

        const t =
          e.results[i][0]
            .transcript;

        if(
          e.results[i].isFinal
        ){

          finalText +=
            t + " ";

        }else{

          interim += t;

        }

      }

      const spoken =
        (
          finalText +
          interim
        ).trim();

      input.value =
        (
          base +
          (
            base &&
            spoken
              ? " "
              : ""
          ) +
          spoken
        ).trimStart();

      autosize();

      updateSend();

    };

  recognition.onerror =
    e => {

      if(
        ![
          "aborted",
          "no-speech"
        ].includes(
          e.error
        )
      ){

        showToast(
          "Microphone: " +
          e.error,
          "error"
        );

      }

    };

  recognition.onend =
    () => {

      isRecording =
        false;

      micBtn.classList.remove(
        "recording"
      );

      micBtn.title =
        "Voice input";

    };

  micBtn.onclick =
    async () => {

      if(isSending)return;

      if(isRecording){

        try{

          recognition.stop();

        }catch{}

        return;

      }

      try{

        if(
          navigator.mediaDevices?.getUserMedia
        ){

          const s =
            await navigator
              .mediaDevices
              .getUserMedia({
                audio:true
              });

          s.getTracks()
            .forEach(
              t => t.stop()
            );

        }

        recognition.start();

      }catch(e){

        showToast(
          e.name ===
          "NotAllowedError"
            ? "Microphone permission was denied."
            : "Could not start microphone.",
          "error"
        );

      }

    };

}

/* =========================================================
   INPUT EVENTS
========================================================= */

input.addEventListener(
  "input",
  () => {

    autosize();

    updateSend();

  }
);

/*
 * Enter sends.
 *
 * Shift + Enter creates a newline.
 */

input.addEventListener(
  "keydown",
  e => {

    if(
      e.key === "Enter" &&
      !e.shiftKey
    ){

      e.preventDefault();

      handleSend();

    }

  }
);

/* =========================================================
   SEND
========================================================= */

sendBtn.onclick =
  handleSend;

/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
  "keydown",
  e => {

    /*
     * Escape stops generation.
     */

    if(
      e.key === "Escape" &&
      isSending &&
      abortController
    ){

      abortController.abort();

    }

    /*
     * Ctrl/Cmd + K creates a new chat.
     */

    if(
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "k"
    ){

      e.preventDefault();

      newChat();

    }

  }
);

/* =========================================================
   NEW CHAT BUTTON
========================================================= */

$("newChatBtn").onclick =
  () => {

    newChat();

    if(
      innerWidth <= 820
    ){

      app.classList.remove(
        "sidebar-open"
      );

    }

  };

/* =========================================================
   SEARCH
========================================================= */

$("searchInput").oninput =
  renderSidebar;

/* =========================================================
   SIDEBAR MENU
========================================================= */

$("menuBtn").onclick =
  () => {

    if(
      innerWidth <= 820
    ){

      app.classList.toggle(
        "sidebar-open"
      );

    }else{

      app.classList.toggle(
        "sidebar-collapsed"
      );

    }

  };

/* =========================================================
   CLOSE MOBILE SIDEBAR
========================================================= */

document.addEventListener(
  "click",
  e => {

    if(
      innerWidth <= 820 &&
      app.classList.contains(
        "sidebar-open"
      ) &&
      !$("sidebar").contains(
        e.target
      ) &&
      !$("menuBtn").contains(
        e.target
      )
    ){

      app.classList.remove(
        "sidebar-open"
      );

    }

  }
);

/* =========================================================
   CLEAR HISTORY
========================================================= */

$("clearBtn").onclick =
  () => {

    if(
      confirm(
        "Delete all local chat history?"
      )
    ){

      state = {

        chats:{},

        order:[],

        activeId:null

      };

      saveState();

      renderAll();

      focusInput();

    }

  };

/* =========================================================
   SETTINGS
========================================================= */

$("settingsBtn").onclick =
  openApiSettings;

$("settingsSideBtn").onclick =
  openApiSettings;

$("closeSettings").onclick =
  closeSettings;

$("settingsModal").onclick =
  e => {

    if(
      e.target ===
      $("settingsModal")
    ){

      closeSettings();

    }

  };

$("saveSettingsBtn").onclick =
  saveSettings;

$("testApiBtn").onclick =
  testApi;

/* =========================================================
   SCROLL BUTTON
========================================================= */

stream.addEventListener(
  "scroll",
  () => {

    $("scrollBottomBtn")
      .classList.toggle(
        "show",
        stream.scrollHeight -
        stream.scrollTop -
        stream.clientHeight >
        180
      );

  }
);

$("scrollBottomBtn").onclick =
  () =>
    scrollToBottom();

/* =========================================================
   INITIALIZE VOICE
========================================================= */

setupVoice();

/* =========================================================
   IMPORTANT STARTUP BEHAVIOR
========================================================= */

/*
 * DO NOT CALL newChat() HERE.
 *
 * The application deliberately starts
 * with a clean welcome screen.
 *
 * Existing chats remain in localStorage
 * and remain available from the sidebar.
 *
 * Refreshing the browser therefore returns
 * the user to the welcome page without
 * creating another empty chat.
 */

state.activeId = null;

renderAll();

refreshApiStatus();

autosize();

updateSend();

focusInput();

})();


document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  document.addEventListener('keydown', function (e) {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && e.key === "I") ||
      (e.ctrlKey && e.key === "U")
    ) {
      e.preventDefault();
      alert("Action disabled");
    }
  });