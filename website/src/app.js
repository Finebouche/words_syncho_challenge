const express = require('express');
const path = require("path");
const app = express()
const axios = require('axios');

// Serve all static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.use(express.json());

// List of available models
const availableModels = [
    { name: 'gpt2', type: 'text-generation', langages : ['en', 'fr'] },
    { name: 'mistralai/Mistral-7B-v0.1', type: 'text-generation', langages : ['en'] },
    { name: 'google/flan-t5-large', type: 'text2text-generation' , langages : ['en'] },
    { name: 'bert-base-uncased', type: 'fill-mask' , langages : ['en'] , mask_token: '[MASK]'},
    { name: 'FacebookAI/xlm-roberta-base', type: 'fill-mask' , langages : ['es', 'en','fr'], mask_token: '<mask>'},
    // Add other models here
];

// Endpoint to get available models
app.get('/available-models', (req, res) => {
    res.json(availableModels);
});


const API_TOKEN = "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";

app.post('/initialize-model', async (req, res) => {
    const model = req.body.model; // Retrieve the model from the request body

    // Check if the model name is valid
    const modelNames = availableModels.map(model => model.name);
    if (!modelNames.includes(model.name)) {
        return res.status(400).send("Invalid model name");
    }

    let token = "initialisation"
    let parameters;
    if (model.type === 'text2text-generation') {
    }

    if (model.type === 'text-generation') {
        parameters = {return_full_text:false, max_new_tokens: 6 }
    }

    if (model.type === 'fill-mask') {
        token = token + " " + model.mask_token
    }

    try {
        const response = await axios.post(
            `https://api-inference.huggingface.co/models/${model.name}`,
            { inputs: token },
            {
                headers: { Authorization: `Bearer ${API_TOKEN}` }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error("Error calling the Hugging Face API", error);
        if (error.response && error.response.status === 503) {
            res.status(503).send("Model is loading");
        } else {
            res.status(500).send("Error calling the Hugging Face API");
        }
    }
});

app.post('/query-model', async (req, res) => {
    const past_words_array = req.body.previous_words;
    const model = req.body.model; // Retrieve the model from the request body

    // Check if the model name is valid
    const modelNames = availableModels.map(model => model.name);
    if (!modelNames.includes(model.name)) {
        return res.status(400).send("Invalid model name");
    }


    const RULE_TOKEN = "We are playing a game where at each round we say an word. The goal is to produce the same word based on previous words at which point the game ends. "
    let WORDS = "We are currently at round 1, please give me your first word and I will give you mine."

    if (Array.isArray(past_words_array) && past_words_array.length > 0) {
        WORDS = `Here are the words that have been played so far and that we cannot use anymore : ${past_words_array.join(', ')}. Please give me your word for the current round and I will give you mine.`
    }

    console.log(model.type)
    let token;
    let parameters;
    if (model.type === 'text2text-generation') {
        token = RULE_TOKEN + WORDS
    }

    if (model.type === 'text-generation') {
        token = "Player 1 : " + RULE_TOKEN + WORDS + "\nPlayer 2 : I choose the word :"
        parameters = {return_full_text:false, max_new_tokens: 20 }
    }

    if (model.type === 'fill-mask') {
        token = "Player 1 : " + RULE_TOKEN + WORDS + "\nPlayer 2 : I choose the word :  " + model.mask_token +  "."
    }
    try {
        const response = await axios.post(
            `https://api-inference.huggingface.co/models/${model.name}`,
            { inputs: token, parameters: parameters, options: { wait_for_model: true }},
            {
                headers: { Authorization: `Bearer ${API_TOKEN}` },
            }
        );
        console.log(response.data)

        if (model.type === "fill-mask") {
            res.json(response.data[0].token_str);
        }
        else {
            res.json(response.data[0].generated_text.match(/\b\w+\b/)?.[0]);
        } 
    } catch (error) {
        console.error("Error calling the Hugging Face API", error);
        res.status(500).send("Error calling the Hugging Face API");
    }
});


module.exports = app