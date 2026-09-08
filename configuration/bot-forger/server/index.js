const GPT_BEARER_TOKEN = process.env.GPT_BEARER_TOKEN;

export const conversational = true;

export const openid = {
  authorization_endpoint:
    'https://auth.smarter.codes/realms/hybrid-chat/protocol/openid-connect/auth',
  token_endpoint:
    'https://auth.smarter.codes/realms/hybrid-chat/protocol/openid-connect/token',
  userinfo_endpoint:
    'https://auth.smarter.codes/realms/hybrid-chat/protocol/openid-connect/userinfo',
  scopes_supported: ['openid', 'profile', 'email'],
  client_id: 'bot-forger',
  realm: 'hybrid-chat',
};

function create_bot({ handler, source = 'default', chatbot_id }) {
  function copyBot(handler, source, destination) {
    let sourcePath = handler.path.join(
      process.cwd(),
      `/configuration/${source}`,
    );
    let destinationPath = handler.path.join(
      process.cwd(),
      `/configuration/${destination}`,
    );

    if (!handler.fs.existsSync(sourcePath)) {
      console.error(`Source bot ${sourcePath} does not exist.`);
      return;
    } else {
      console.log(`Source bot ${sourcePath} does exist.`);
    }

    if (!handler.fs.existsSync(destinationPath)) {
      handler.fs.mkdirSync(destinationPath);
      handler.fs.copySync(sourcePath, destinationPath, { recursive: true });
      console.log(`Bot ${destination} created from ${source}`);
    } else {
      console.log(`Destination bot ${sourcePath} already exists.`);
    }
  }

  copyBot(handler, source, chatbot_id);

  let answer = `visit
            <a target="_blank" href="${process.env.NEXT_PUBLIC_NEXTAUTH_URL}?chat-id=${chatbot_id}">
              ${process.env.NEXT_PUBLIC_NEXTAUTH_URL}?chat-id=${chatbot_id}
            </a>`;
  return answer;
}

function get_chat_steps({ handler, chatbot_id }) {
  const filePath = handler.path.join(
    process.cwd(),
    `/configuration/${chatbot_id}/server/index.js`,
  );
  const fileContent = handler.fs.readFileSync(filePath, 'utf-8');

  const ast = handler.parser.parse(fileContent, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  const ChatBotStep = ast.program.body
    .filter(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.declarations[0]?.id.name === 'ChatBotStep',
    )
    .map((node) => node.declaration.declarations[0]);

  return ChatBotStep[0]?.init?.body?.elements?.map((e, index) => {
    let v = handler.generator.default(e)?.code;
    let q = /\s*question\s*:\s*(['"`])((?:.|\n)*?)\1/.exec(v);
    let h = /\s*html\s*:\s*(['"`])((?:.|\n)*?)\1/.exec(v);
    let question = q && `${q[1]}${q[2]}${q[1]}`;
    let html = h && `${h[1]}${h[2]}${h[1]}`;

    let step = q[2] ? question : handler.htmlToText(html);
    return { index: index + 1, step };
  });
}

function get_chat_step({ handler, chatbot_id, step_id, step_question }) {
  const filePath = handler.path.join(
    process.cwd(),
    `/configuration/${chatbot_id}/server/index.js`,
  );
  const fileContent = handler.fs.readFileSync(filePath, 'utf-8');

  const ast = handler.parser.parse(fileContent, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  const ChatBotStep = ast.program.body
    .filter(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.declarations[0]?.id.name === 'ChatBotStep',
    )
    .map((node) => node.declaration.declarations[0]);

  console.log(ChatBotStep[0]?.init?.body?.elements[0]);
  let value = handler.generator.default(
    ChatBotStep[0]?.init?.body?.elements[0],
  )?.code;

  console.log(value.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": '));
  return value;
}

function insert_chat_step({ handler, chatbot_id, step }) {
  const filePath = handler.path.join(
    process.cwd(),
    `/configuration/${chatbot_id}/server/index.js`,
  );
  const fileContent = handler.fs.readFileSync(filePath, 'utf-8');

  const ast = handler.parser.parse(fileContent, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  const ChatBotStep = ast.program.body
    .filter(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.declarations[0]?.id.name === 'ChatBotStep',
    )
    .map((node) => node.declaration.declarations[0]);

  const steps = ChatBotStep[0]?.init?.body?.elements;

  step.id = steps.length;

  let formattedStep = handler.json5
    .stringify(step)
    .replace(/preHook:"([^"]*)"/, 'preHook:$1')
    .replace(/callBack:"([^"]*)"/, 'callBack:$1')
    .replace(/preHook:'([^']*)'/, 'preHook:$1')
    .replace(/callBack:'([^']*)'/, 'callBack:$1')
    .replace(/nextStep:([^,]*),/g, `nextStep:${steps.length + 1},`);

  const newStep = handler.parser.parseExpression(formattedStep, {
    sourceType: 'script',
    plugins: ['jsx'],
  });

  steps.push(newStep);

  const updatedContent = handler.generator.default(ast, {}, fileContent).code;

  handler.fs.writeFileSync(filePath, updatedContent, 'utf-8');
}

function update_chat_step({ handler, chatbot_id, step, step_position }) {}

function delete_chat_step({ handler, chatbot_id, step_position }) {}

function get_webapp_nodes({ handler, chatbot_id }) {
  const filePath = handler.path.join(
    process.cwd(),
    `/configuration/${chatbot_id}/webapp/index.js`,
  );
  const fileContent = handler.fs.readFileSync(filePath, 'utf-8');

  const ast = handler.parser.parse(fileContent, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  const nodeDeclarations = ast.program.body
    .filter(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.declarations[0]?.id.name,
    )
    .map((node) => node.declaration.declarations[0]?.id.name);

  return nodeDeclarations;
}

function get_webapp_node_value({ handler, chatbot_id, node_name }) {
  const filePath = handler.path.join(
    process.cwd(),
    `/configuration/${chatbot_id}/webapp/index.js`,
  );
  const fileContent = handler.fs.readFileSync(filePath, 'utf-8');

  const ast = handler.parser.parse(fileContent, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  const nodeDeclaration = ast.program.body
    .filter(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.declarations[0]?.id.name === node_name,
    )
    .map((node) => node.declaration.declarations[0]);

  let value = handler.generator.default(nodeDeclaration[0]?.init)?.code;

  return value;
}

function update_webapp_node_value({
  handler,
  chatbot_id,
  node_name,
  node_value,
}) {
  const filePath = handler.path.join(
    process.cwd(),
    `/configuration/${chatbot_id}/webapp/index.js`,
  );
  const fileContent = handler.fs.readFileSync(filePath, 'utf-8');

  const ast = handler.parser.parse(fileContent, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  const nodeDeclaration = ast.program.body
    .filter(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.declarations[0]?.id.name === node_name,
    )
    .map((node) => node.declaration.declarations[0]);

  const updatedNode = handler.parser.parseExpression(node_value, {
    sourceType: 'script',
    plugins: ['jsx'],
  });

  nodeDeclaration[0].init = updatedNode;
  const updatedContent = handler.generator.default(ast, {}, fileContent).code;

  handler.fs.writeFileSync(filePath, updatedContent, 'utf-8');
}

async function handleChatGPT(handler, description, prompt) {
  if (!description) return '';
  try {
    let url = 'https://api.openai.com/v1/chat/completions';
    let body = {
      model: 'gpt-4',
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: `${description}\n\n${prompt}`,
        },
      ],
    };
    let headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GPT_BEARER_TOKEN}`,
    };
    const response = await handler.axiosInstance.post(url, body, { headers });
    console.log(response.data.choices[0].message);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error in ChatGPT Request:', error?.response?.data);
    return 'Error in ChatGPT Request';
  }
}

export const ChatBotStep = ({ chatBotId, tokenUser, answer }) => [
  {
    preHook: (event, response) => {
      if (tokenUser?.email) {
        return { nextStep: 1, error: false };
      } else {
        return { error: true };
      }
    },
    id: 0,
    inputType: 'html',
    question: '',
    options: [],
    html: `
    <div style="text-align: center;">
      <img src="https://dri.es/files/images/blog/javascript-powered-multichannel.gif" style="width: 100%; max-height: 50vh; object-fit: cover;">
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <p>To <b>initiate the process</b> and <b>develop your own chatbot</b>, take the first step by <b>joining the service</b> today. Explore the <b>innovative features</b> and <b>customize</b> your chatbot to meet your specific needs.</p>
      <a href="${openid.authorization_endpoint}?response_type=code&client_id=${
      openid.client_id
    }&redirect_uri=${encodeURIComponent(
      `${process.env.NEXT_PUBLIC_NEXTAUTH_URL}?chat-id=${chatBotId}`,
    )}&scope=${openid.scopes_supported.join(' ')}">
        <button style="border-radius: 6px; margin-top: 20px; padding: 5px 25px 10px 25px; font-size: 16px; color: #fff; background-color: #3498db">Login</button>
      </a>
    </div>
  `,
    options: [],
    inputHidden: true,
    callBack: (event, response) => {
      return { nextStep: 1, toast: '', error: false };
    },
  },
  {
    id: 1,
    question:
      answer ||
      "I am a Assistant. I'll assist you with any queries related to bot management",
    inputType: 'text',
    options: [],
    callBack: async (event, response) => {
      let answer = '';

      let intent_prompt = `Generate JSON output {intent: "", intent_data: {}}. Detect Intent from above description. "intent" must be one of "create_chatbot", "select_chatbot", or "unknown". If detected intent is "create_chatbot", include "chatbot_id" in the intent_data. If detected intent is "select_chatbot" intent, include "chatbot_id" in the intent_data. If chatbot_id is not specified unset chatbot_id. If no intent is provided, set the intent as "unknown". Only provide JSON and no description so that the response can be parsed with JSON.parse`;

      let content = await handleChatGPT(
        event,
        `description: ${response}`,
        intent_prompt,
      );
      let { intent, intent_data } = JSON.parse(content);

      switch (intent) {
        case 'create_chatbot':
          if (intent_data?.chatbot_id) {
            insertUserDataWithKey(
              event,
              'chatbot_id',
              intent_data?.chatbot_id,
              'text',
              false,
            );
            await event.user.save();

            answer = create_bot({
              handler: event,
              chatbot_id: intent_data?.chatbot_id,
              source: 'default',
            });

            return { nextStep: 1, toast: '', error: false, answer };
          }
          break;
        case 'select_chatbot':
          if (intent_data?.chatbot_id) {
            insertUserDataWithKey(
              event,
              'chatbot_id',
              intent_data?.chatbot_id,
              'text',
              false,
            );
            await event.user.save();

            answer = `visit
            <a target="_blank" href="${process.env.NEXT_PUBLIC_NEXTAUTH_URL}?chat-id=${intent_data?.chatbot_id}">
              ${process.env.NEXT_PUBLIC_NEXTAUTH_URL}?chat-id=${intent_data?.chatbot_id}
            </a>`;

            return { nextStep: 1, toast: '', error: false, answer };
          }
          break;
        default:
          break;
      }

      let chatbot_id = event.user.getData('chatbot_id')?.answer;
      if (!chatbot_id) {
        answer =
          'Please either select a existing chatbot or create a new bot!!';
        return { nextStep: 1, toast: '', error: false, answer };
      }

      let webapp_nodes = get_webapp_nodes({
        handler: event,
        chatbot_id: chatbot_id,
      });

      let step_schema = `{
        preHook: (event, response) => {
          return { nextStep: 1, error: true };
        },
        id: 0,
        inputType: 'html' | 'text',
        question: '',
        options: [],
        html: '<div>Hello</div>',
        callBack: (event, response) => {
          return { nextStep: 1, toast: '', error: false };
        },
      }`;

      intent_prompt = `Generate JSON output {intent: "", intent_data: {}}. Detect Intent from above description. "intent" must be one of "create_chatbot", "insert_chat_step", "update_webapp" or "unknown". If detected intent is "create_chatbot", include "chatbot_id" in the intent_data. If detected intent is "update_webapp" intent, include "webapp_node" in the intent_data, ensure that "webapp_node" is one of "${webapp_nodes}". If detected intent is "update_webapp" intent, include "node_update_request" in the intent_data, it should specify what is requested for update. "node_update_request" must be a string for GPT prompt. If detected intent is "insert_chat_step" intent, include "step" in the intent_data. Step can have inputType as text or html. If inputType is text then set question. If inputType is html then set html. step must include all the fields in JSON with schema: ${step_schema}. If detected intent is "insert_chat_step" intent, include "step_position" in the intent_data. step_position is a prompt describing position of this step, set "step_position" to end if not found. If no intent is provided, set the intent as "unknown". Only provide JSON and no description so that the response can be parsed with JSON.parse`;

      content = await handleChatGPT(
        event,
        `description: ${response}`,
        intent_prompt,
      );
      intent = JSON.parse(content)?.intent;
      intent_data = JSON.parse(content)?.intent_data;

      switch (intent) {
        case 'create_chatbot':
          if (intent_data?.chatbot_id) {
            answer = create_bot({
              handler: event,
              chatbot_id: intent_data?.chatbot_id,
              source: 'default',
            });
          }
          insertUserDataWithKey(
            event,
            'chatbot_id',
            intent_data?.chatbot_id,
            'text',
            false,
          );
          await event.user.save();
          break;
        case 'update_webapp':
          if (intent_data?.webapp_node) {
            let webapp_node_value = get_webapp_node_value({
              handler: event,
              chatbot_id: chatbot_id,
              node_name: intent_data?.webapp_node,
            });
            let update_webapp_prompt = `update above with request '${intent_data?.node_update_request}'. Ensure to keep same data type and structure and show full code with no description and no explaination.`;
            content = await handleChatGPT(
              event,
              webapp_node_value,
              update_webapp_prompt,
            );
            answer = update_webapp_node_value({
              handler: event,
              chatbot_id: chatbot_id,
              node_name: intent_data?.webapp_node,
              node_value: content,
            });
          }
          break;
        case 'insert_chat_step':
          if (intent_data?.step) {
            answer = insert_chat_step({
              handler: event,
              chatbot_id: chatbot_id,
              step: intent_data?.step,
            });
          }
          break;
        default:
          break;
      }
      return { nextStep: 1, toast: '', error: false, answer };
    },
  },
];

export const insertUserData = (handler, step, answer, summary = true) => {
  let obj = {};
  let currentStep = ChatBotStep().find((item) => item.id == step);
  if (currentStep.header) {
    obj = {
      key: currentStep.mongo_key,
      category_id: currentStep.header.step,
      category_description: currentStep.header.text,
      inputType: currentStep.inputType,
      answer: answer,
      summary: summary,
    };
  } else {
    obj = {
      key: currentStep.mongo_key,
      answer: answer,
      inputType: currentStep.inputType,
      summary: summary,
    };
  }
  handler.user.setUserData(obj);
};

export const insertUserDataWithKey = (
  handler,
  key,
  answer,
  inputType,
  summary = true,
) => {
  let obj = {
    key: key,
    answer: answer,
    inputType: inputType,
    summary: summary,
  };
  handler.user.setUserData(obj);
};

export const start = async (handler, question) => {
  let { chatBotId } = handler;
  let tokenUser = {};

  if (conversational) {
    const token = handler.headers?.authorization || '';

    if (token) {
      handler.axiosInstance.defaults.headers.common['Authorization'] = token;
      try {
        let res = await handler.axiosInstance.get(openid.userinfo_endpoint);
        tokenUser = res.data;
      } catch (error) {}
    }

    let currentStep = handler.user?.getlastStep ? await handler.user.getlastStep() : undefined;
    let answ = ChatBotStep({ chatBotId, tokenUser }).find(
      (item) => item.id == currentStep,
    );

    if (answ === undefined)
      return {
        text: "Sorry, I don't have an answer for that.",
        currentStep: {
          inputHidden: true,
        },
        src: 'talkingDb',
      };

    if (answ.preHook) {
      const { nextStep, error } = await answ.preHook(handler, question);
      if (error === false) {
        handler.user.setlastStep(nextStep);
        return await start(handler, question);
      }
    }

    if (!handler.user.getData('firstCall')?.answer) {
      insertUserDataWithKey(handler, 'firstCall', 'true', 'text', false);
      await handler.user.save();
      return {
        text: answ.question,
        src: 'talkingDb',
        currentStep: answ,
        hideAnswer: false,
      };
    }
    if (answ === undefined) return { text: finalMessage, src: 'talkingDb' };
    if (answ.callBack) {
      const { nextStep, toast, error, hideAnswer, answer } =
        await answ.callBack(handler, question);
      handler.user.setlastStep(nextStep);
      await handler.user.save();
      answ = ChatBotStep({ chatBotId, tokenUser, answer }).find(
        (item) => item.id == nextStep,
      );

      if (answ.apiCall) {
        answ.options = await answ.apiResult(handler);
      }
      if (answ.inputType === 'summary') {
        answ['data'] = handler.user.getUserData();
      }
      if (answ.inputType === 'await') {
        answ['await'] = 4000;
      }

      if (error) {
        const clonedObject = JSON.parse(JSON.stringify(answ));
        clonedObject['answer'] = question;
        if (answ.inputType === 'fileUploader') {
          const { fileName, imageData } = JSON.parse(question);
          clonedObject['answer'] = fileName;
          clonedObject['showQuestion'] = true;
          delete clonedObject.header;
        }

        if (answ.inputType === 'googleLogin') {
          clonedObject['answer'] = JSON.parse(question).email;
          clonedObject['showQuestion'] = true;
        }
        answ = clonedObject;
      }

      if (answ.header) {
        answ['update'] = true;
      }

      return {
        text: answ.question,
        src: 'talkingDb',
        currentStep: answ,
        error: error,
        errorMessage: toast || '',
        hideAnswer: hideAnswer || false,
      };
    }
    return {
      text: answ.question,
      src: 'talkingDb',
      currentStep: answ,
      error: error,
      errorMessage: toast || '',
      hideAnswer: hideAnswer || false,
    };
  } else {
    const response = await handler.chain.run(question);
    return response;
  }
};
