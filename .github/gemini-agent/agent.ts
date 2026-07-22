import { Octokit } from '@octokit/rest';
import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  
  if (!token || !eventPath) {
    console.error('Missing required env variables');
    process.exit(1);
  }
  
  const octokit = new Octokit({ auth: token });
  const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  
  // Extract context
  const repoFullName = process.env.GITHUB_REPOSITORY;
  const [owner, repo] = repoFullName ? repoFullName.split('/') : ['', ''];
  const issueNumber = eventData.issue?.number || eventData.pull_request?.number;
  
  if (!issueNumber) {
    console.log('No issue or PR found in event payload.');
    return;
  }
  
  // Try to use Gemini
  const ai = new GoogleGenAI({});
  
  try {
    const chat = ai.chats.create({
      model: 'gemini-3.1-pro',
      config: {
        systemInstruction: 'You are an autonomous GitHub Copilot. Review code, answer questions, and solve issues.',
      }
    });
    
    let prompt = \`Review the following event on \${repoFullName} issue #\${issueNumber}.\\n\`;
    if (eventData.issue) {
       prompt += \`Title: \${eventData.issue.title}\\nBody: \${eventData.issue.body}\`;
    }
    
    const response = await chat.sendMessage({ message: prompt });
    
    // Post comment
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: \`🤖 **Gemini Agent Review:**\\n\\n\${response.text}\`
    });
    
    console.log('Successfully commented on issue/PR.');
  } catch (error) {
    console.error('Error in agent execution:', error);
  }
}

main().catch(console.error);