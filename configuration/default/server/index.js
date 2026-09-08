export const conversational = true;

export const openid = {
  authorization_endpoint: '',
  token_endpoint: '',
  userinfo_endpoint: '',
  scopes_supported: ['openid', 'profile', 'email'],
  client_id: '',
  realm: '',
};

export const ChatBotStep = ({ chatBotId, tokenUser, answer }) => [];

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
    let answ = ChatBotStep({
      chatBotId,
      tokenUser,
    }).find((item) => item.id == currentStep);
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
    if (answ.callBack) {
      const { nextStep, toast, error, hideAnswer, answer } =
        await answ.callBack(handler, question);
      handler.user.setlastStep(nextStep);
      await handler.user.save();
      answ = ChatBotStep({
        chatBotId,
        tokenUser,
        answer,
      }).find((item) => item.id == nextStep);
      if (answ === undefined)
        return {
          text: "Sorry, I don't have an answer for that.",
          currentStep: {
            inputHidden: true,
          },
          src: 'talkingDb',
        };
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
