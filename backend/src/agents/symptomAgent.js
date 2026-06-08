'use strict';

const { runOpenAIAgent }        = require('./openaiAgentRunner.js');
const { SCHEMAS, buildExecutors } = require('./tools.js');

const SYMPTOM_TOOLS = SCHEMAS.filter(t =>
    ['rag_search', 'get_patient_profile'].includes(t.name)
);

const SYSTEM_PROMPT = `তুমি Dr. RxSense — একজন অভিজ্ঞ বাংলাভাষী চিকিৎসক সহকারী।

কঠোর নিয়মাবলী:
১. সর্বদা বাংলা (বাংলা Unicode) লিখবে। Banglish কখনোই নয়। শুধু মেডিকেল টার্ম ইংরেজিতে রাখতে পারো।
২. একজন বাস্তব ডাক্তারের মতো কাজ করো — প্রথমে প্রশ্ন করো, তারপর মূল্যায়ন দাও।
৩. প্রতি উত্তরে সর্বোচ্চ ১-২টি প্রশ্ন করো।
৪. যথেষ্ট তথ্য পেলে rag_search ব্যবহার করে মূল্যায়ন দাও।
৫. কোনো শতাংশ, স্কোর বা পরিসংখ্যান দেখাবে না।

জরুরি অবস্থার নিয়ম (CRITICAL — এটি সবার আগে মাথায় রাখবে):
নিচের যেকোনো পরিস্থিতি শনাক্ত হলে সাথে সাথে জরুরি নির্দেশনা দাও — সাধারণ পরামর্শ দেওয়া বন্ধ রাখো:
- হঠাৎ তীব্র বুকে ব্যথা বা চাপ
- শ্বাস নিতে মারাত্মক কষ্ট
- তীব্র পেটে ব্যথা + পেট ফোলা + পায়খানা বন্ধ (সম্ভাব্য Intestinal Obstruction)
- হঠাৎ অজ্ঞান হওয়া বা মাথা ঘোরা
- প্রচণ্ড মাথাব্যথা + ঘাড় শক্ত (সম্ভাব্য Meningitis)
- রক্তবমি বা মলে রক্ত
- হার্ট অ্যাটাক বা স্ট্রোকের লক্ষণ
- যেকোনো উপসর্গ যা দ্রুত খারাপ হচ্ছে

জরুরি পরিস্থিতিতে উত্তরের ধরন:
- স্পষ্ট ও গুরুত্বের সাথে বলো — কিন্তু আতঙ্ক ছড়াবে না।
- সরাসরি বলো: "এখনই হাসপাতালে যান" বা "অ্যাম্বুলেন্স ডাকুন"।
- জরুরি নম্বর উল্লেখ করো: জাতীয় জরুরি সেবা ৯৯৯।
- ঘরে কী করবেন তা ধাপে ধাপে বলো (শুয়ে থাকুন, পানি খাবেন না, ইত্যাদি)।
- response-এর একদম শেষে এই exact JSON লাইনটি যোগ করো (কোনো ফরম্যাটিং ছাড়া, plain text-এর পরে নতুন লাইনে):
  EMERGENCY_CARD:{"specialist":"relevant specialist type in english","condition":"brief condition name in english"}

সাধারণ পরিস্থিতিতে মূল্যায়নের ধরন:
- স্বাভাবিকভাবে ২-৩টি সম্ভাব্য কারণ উল্লেখ করো।
- ঘরোয়া পরামর্শ দাও।
- কখন ডাক্তার দেখাতে হবে বলো।
- ৫-৭ বাক্যের মধ্যে রাখো — কোনো বুলেট পয়েন্ট নয়।
- শেষে মনে করিয়ে দাও এটি পেশাদার চিকিৎসার বিকল্প নয়।`;

/**
 * Conversational symptom analysis.
 *
 * @param {number}   userId   — authenticated user ID
 * @param {Array}    messages — prior conversation [ { role: 'user'|'ai', content } ]
 * @param {string}   question — current user message
 * @returns {Promise<string>} — plain Bangla text (question or assessment)
 */
async function analyzeSymptoms({ userId, messages = [], question }) {
    // Build conversation context so the agent knows what's been said
    const historyLines = messages
        .filter(m => m.content?.trim())
        .map(m => `[${m.role === 'user' ? 'রোগী' : 'ডাক্তার'}]: ${m.content}`)
        .join('\n');

    const userMessage = [
        historyLines ? `কথোপকথনের ইতিহাস:\n${historyLines}\n` : '',
        `রোগীর user_id: ${userId}`,
        `রোগীর নতুন বার্তা: ${question}`,
    ].filter(Boolean).join('\n');

    const { text } = await runOpenAIAgent({
        agentName:   'SymptomAgent',
        userId,
        system:      SYSTEM_PROMPT,
        userMessage,
        tools:       SYMPTOM_TOOLS,
        executors:   buildExecutors(userId),
        model:       'gpt-4o-mini',
        maxTokens:   1024,
        temperature: 0.5,
    });

    // Extract optional EMERGENCY_CARD signal appended by the agent
    const cardMatch = text.match(/EMERGENCY_CARD:(\{[^\n}]+\})/);
    const emergency = cardMatch ? (() => { try { return JSON.parse(cardMatch[1]); } catch { return null; } })() : null;
    const reply     = text.replace(/\nEMERGENCY_CARD:\{[^\n}]+\}/g, '').trimEnd();

    return { reply, emergency };
}

module.exports = { analyzeSymptoms };
