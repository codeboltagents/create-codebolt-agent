#!/usr/bin/env node

// Usage: npx create-codebolt-agent my-app

const spawn = require('cross-spawn');
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const inquirer = require('inquirer');
const yaml = require('js-yaml');

const program = new Command();
program.option('-n, --name <name>', 'name of the project');
program.parse(process.argv);

const options = program.opts();
let projectName = '';
projectName = options.name || process.argv[2];

// Get the list of available templates
const templateDir = path.resolve(__dirname, 'template');
const templates = fs.readdirSync(templateDir).filter(file => fs.statSync(path.join(templateDir, file)).isDirectory());

// Sample metadata object
const metadata = {
  agent_routing: {
    worksonblankcode: true,
    worksonexistingcode: true,
    softwaredevprocessmanaged: [
      'projectplanning',
      'codegeneration',
      'codetesting',
      'codeoptimization',
    ],
    supportedlanguages: [
      'all',
      'javascript',
      'typescript',
      'python',
      'go',
      'ruby',
    ],
    supportedframeworks: [
      'all',
      'nextjs',
      'reactjs',
      'nodejs',
      'express',
      'django',
    ],
  },
  defaultagentllm: {
    strict: true,
    modelorder: ['ollama2'],
  },
  sdlc_steps_managed: [
    {
      name: 'codegeneration',
      example_instructions: [
        'Generate a new React component',
        'Create a new API endpoint',
      ],
    },
    {
      name: 'deployment',
      example_instructions: [
        'deploy this file to cloudflare',
        'deploy this file to firebase',
      ],
    },
  ],
  llm_role: [
    {
      name: 'documentationllm',
      description: 'LLM to be used for advanced Documentation. Please select a model that excels in documentation tasks.',
      strict: true,
      modelorder: [
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'mistral7b.perplexity',
        'mistral7b.any',
        'llama2-70b',
        'llama2-15b',
        'group.documentationmodels',
      ],
    },
    {
      name: 'testingllm',
      description: 'LLM to be used for advanced Testing. Please select a model that excels in testing tasks.',
      strict: true,
      modelorder: [
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'mistral7b.perplexity',
        'mistral7b.any',
        'llama2-70b',
        'llama2-15b',
        'group.testingmodels',
      ],
    },
    {
      name: 'actionllm',
      description: 'LLM to be used for executing advanced actions.',
      strict: true,
      modelorder: [
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'mistral7b.perplexity',
        'mistral7b.any',
        'llama2-70b',
        'llama2-15b',
        'group.actionmodels',
      ],
    },
  ],
  actions: [
    {
      name: 'Execute',
      description: 'Executes the given task.',
      detailDescription: 'more detailed description',
      actionPrompt: 'Please run this code',
    },
    {
      name: 'Debug',
      description: 'Debugs the code.',
      actionPrompt: 'Please debug this code',
    },
  ],
};

const prompts = [
  {
    type: 'input',
    name: 'projectName',
    message: 'Please enter the name of your application:',
    default: projectName,
  },
  {
    type: 'input',
    name: 'installPath',
    message: 'Please enter the path to install the application:',
    default: projectName,
  },
  {
    type: 'list',
    name: 'template',
    message: 'Please select a template for your application:',
    choices: templates,
  },
  {
    type: 'input',
    name: 'agentDescription',
    message: 'Please enter a description for your agent:',
    default: 'My Codebolt Agent',
  },
];

// Add metadata prompts
if (metadata.agent_routing) {
  prompts.push({
    type: 'confirm',
    name: 'worksonblankcode',
    message: 'Works on blank code:',
    default: metadata.agent_routing.worksonblankcode,
  });

  prompts.push({
    type: 'confirm',
    name: 'worksonexistingcode',
    message: 'Works on existing code:',
    default: metadata.agent_routing.worksonexistingcode,
  });

  prompts.push({
    type: 'checkbox',
    name: 'softwaredevprocessmanaged',
    message: 'Managed Software Development Processes:',
    choices: metadata.agent_routing.softwaredevprocessmanaged,
  });

  prompts.push({
    type: 'checkbox',
    name: 'supportedlanguages',
    message: 'Supported Languages:',
    choices: metadata.agent_routing.supportedlanguages,
  });

  prompts.push({
    type: 'checkbox',
    name: 'supportedframeworks',
    message: 'Supported Frameworks:',
    choices: metadata.agent_routing.supportedframeworks,
  });
}

if (metadata.sdlc_steps_managed) {
  metadata.sdlc_steps_managed.forEach(step => {
    prompts.push({
      type: 'checkbox',
      name: `${step.name}Instructions`,
      message: `Example Instructions for ${step.name}:`,
      choices: step.example_instructions,
    });
  });
}

if (metadata.llm_role) {
  metadata.llm_role.forEach(role => {
    prompts.push({
      type: 'checkbox',
      name: role.name,
      message: role.description,
      choices: role.modelorder,
    });
  });
}

if (metadata.actions) {
  metadata.actions.forEach(action => {
    prompts.push({
      type: 'input',
      name: `${action.name}ActionPrompt`,
      message: `${action.name} action prompt:`,
      default: action.actionPrompt,
    });
  });
}

inquirer.prompt(prompts).then(answers => {
  projectName = answers.projectName.trim();
  const installPath = answers.installPath.trim() === '.' ? process.cwd() : path.resolve(process.cwd(), answers.installPath.trim());
  const selectedTemplate = answers.template;
  createProject(projectName, installPath, selectedTemplate, answers);
});

function createProject(projectName, installPath, selectedTemplate, answers) {
  // Create a project directory with the project name.
  const projectDir = path.resolve(installPath);
  fs.mkdirSync(projectDir, { recursive: true });

  // Copy the selected template to the project directory
  const templatePath = path.join(templateDir, selectedTemplate);
  fs.cpSync(templatePath, projectDir, { recursive: true });

  fs.renameSync(
    path.join(projectDir, 'gitignore'),
    path.join(projectDir, '.gitignore')
  );

  const agentYamlPath = path.join(projectDir, 'codeboltagent.yaml');
  let agentYaml = fs.readFileSync(agentYamlPath, 'utf8');
  
  let agentYamlObj = yaml.load(agentYaml);
  agentYamlObj.name = projectName;
  agentYamlObj.description = answers.agentDescription;
  agentYamlObj.agent_routing = {
    worksonblankcode: answers.worksonblankcode,
    worksonexistingcode: answers.worksonexistingcode,
    softwaredevprocessmanaged: answers.softwaredevprocessmanaged,
    supportedlanguages: answers.supportedlanguages,
    supportedframeworks: answers.supportedframeworks,
  };
  agentYamlObj.sdlc_steps_managed = metadata.sdlc_steps_managed.map(step => ({
    name: step.name,
    example_instructions: answers[`${step.name}Instructions`],
  }));
  agentYamlObj.llm_role = metadata.llm_role.map(role => ({
    name: role.name,
    description: role.description,
    modelorder: answers[role.name],
  }));
  agentYamlObj.actions = metadata.actions.map(action => ({
    name: action.name,
    description: action.description,
    detailDescription: action.detailDescription,
    actionPrompt: answers[`${action.name}ActionPrompt`],
  }));
  
  agentYaml = yaml.dump(agentYamlObj);
  fs.writeFileSync(agentYamlPath, agentYaml, 'utf8');

  const projectPackageJson = require(path.join(projectDir, 'package.json'));

  // Update the project's package.json with the new project name
  projectPackageJson.name = projectName;

  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify(projectPackageJson, null, 2)
  );

  // Run `npm install` in the project directory to install
  // the dependencies. We are using a third-party library
  // called `cross-spawn` for cross-platform support.
  // (Node has issues spawning child processes in Windows).
  spawn.sync('npm', ['install'], { stdio: 'inherit', cwd: installPath });

  spawn.sync('git', ['init'], { stdio: 'inherit', cwd: installPath });

  console.log('Success! Your new project is ready.');
  console.log(`Created ${projectName} at ${projectDir}`);
}
