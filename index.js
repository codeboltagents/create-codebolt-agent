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

const agentymlpath = path.join('./template/basic', 'codeboltagent.yaml');
  let agentYamlData = fs.readFileSync(agentymlpath, 'utf8');

  // Parse the YAML file
  const parsedYaml = yaml.load(agentYamlData);


let agent_routing = []
let defaultagentllm = []
let sdlc_steps_managed = []
let llm_role = []
let actions = []
const currentPath = process.cwd(); // Gets the current working directory

const prompts = [
  {
    type: 'input',
    name: 'projectName',
    message: 'Please enter the name of your application:',
    default: projectName,
  },
  {
    type: 'input',
    name: 'unique_id',
    message: 'Please enter the name of your Unique_id:',
  },
  {
    type: 'input',
    name: 'installPath',
    message: 'Please enter the path to install the application:',
    default: (answers) => path.join(currentPath, answers.projectName || 'defaultProjectName'),
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
  {
    type: 'list',
    name: 'tags',
    message: 'Please select tags:',
    choices: parsedYaml.tags,
  },
];

// Add metadata prompts
if (parsedYaml.metadata.agent_routing) {
  prompts.push({
    type: 'confirm',
    name: 'worksonblankcode',
    message: 'Works on blank code:',
    default: parsedYaml.metadata.agent_routing.worksonblankcode,
  });

  prompts.push({
    type: 'confirm',
    name: 'worksonexistingcode',
    message: 'Works on existing code:',
    default: parsedYaml.metadata.agent_routing.worksonexistingcode,
  });

  prompts.push({
    type: 'list',
    name: 'supportedlanguages',
    message: 'Supported Languages:',
    choices: parsedYaml.metadata.agent_routing.supportedlanguages,
  });

  prompts.push({
    type: 'list',
    name: 'supportedframeworks',
    message: 'Supported Frameworks:',
    choices: parsedYaml.metadata.agent_routing.supportedframeworks,
  });
}

if (parsedYaml.metadata.llm_role) {
  parsedYaml.metadata.llm_role.forEach(role => {
    prompts.push({
      type: 'list',
      name: role.name,
      message: role.description,
      choices: role.modelorder,
    });
  });
}

// async function askForActions(res) {
//   let addMoreActions = true;
//   while (addMoreActions) {
//     const actionPrompt = [
//       {
//         type: 'input',
//         name: 'actionName',
//         message: 'Please Enter Action Name:',
//       },
//       {
//         type: 'input',
//         name: 'actionDescription',
//         message: 'Please Enter Action Description:',
//       },
//       {
//         type: 'input',
//         name: 'detailDescription',
//         message: 'Please Enter Detail Description (optional):',
//       },
//       {
//         type: 'input',
//         name: 'actionPrompt',
//         message: 'Please Enter Action Prompt (optional):',
//       },
//       {
//         type: 'confirm',
//         name: 'addMoreActions',
//         message: 'Do you want to add more actions?',
//         default: false,
//       }
//     ];

//     const actionRes = await inquirer.prompt(actionPrompt);
//     res.push({
//       name: actionRes.actionName,
//       description: actionRes.actionDescription,
//       detailDescription: actionRes.detailDescription,
//       actionPrompt: actionRes.actionPrompt,
//     });
//     addMoreActions = actionRes.addMoreActions;
//   }
//   return res;
// }

async function askForInstructions() {
 let res= []
  let addMoreInstructions = true;
  while (addMoreInstructions) {
    const additionalPrompt = [
      {
        type: 'input',
        name: 'InstructionName',
        message: 'Please Enter SDLC Step Name:',
        default: parsedYaml.metadata.sdlc_steps_managed.name,
      },
      {
        type: 'input',
        name: 'InstructionDescription',
        message: 'Please Enter Instruction Description:',
        default:  'Generate a new React component'
      },
      {
        type: 'confirm',
        name: 'addMoreInstructions',
        message: 'Do you want to add more instructions?',
        default: false,
      }
    ];

    const additionalRes = await inquirer.prompt(additionalPrompt);
    res[`sdlcName${additionalRes.InstructionName}`] = additionalRes.InstructionName;
    res[`sdlcDescription${additionalRes.InstructionName}`] = additionalRes.InstructionDescription;
    addMoreInstructions = additionalRes.addMoreInstructions;
  }
  return res;
}

inquirer.prompt(prompts).then(async answers => {
  let res = [];
  let instructions = await askForInstructions(res)
  console.log(instructions)
  projectName = answers.projectName.trim();
  const installPath = answers.installPath.trim() === '.' ? process.cwd() : path.resolve(process.cwd(), answers.installPath.trim());
  const selectedTemplate = answers.template;
  createProject(projectName, installPath, selectedTemplate, answers);
});

function createProject(projectName, installPath, selectedTemplate, answers) {
  
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
  agentYamlObj.title = projectName;
  agentYamlObj.description = answers.agentDescription;
  agentYamlObj.tags = answers.tags;
  agentYamlObj.unique_id = answers.unique_id;
  agentYamlObj.metadata.agent_routing = {
    worksonblankcode: answers.worksonblankcode,
    worksonexistingcode: answers.worksonexistingcode,
    softwaredevprocessmanaged: answers.softwaredevprocessmanaged,
    supportedlanguages: answers.supportedlanguages,
    supportedframeworks: answers.supportedframeworks,
  };

  agentYamlObj.metadata.sdlc_steps_managed = metadata.sdlc_steps_managed.map(step => ({
    name: answers[`sdlcName${step.name}`],
    example_instructions: answers[`example_instructions${step.name}`],
  }));

  agentYamlObj.metadata.llm_role = metadata.llm_role.map(role => ({
    name: role.name,
    description: role.description,
    modelorder: answers[role.name],
  }));

  agentYamlObj.actions = parsedYaml.actions.map(action => ({
    name: answers[`name${action.name}`],
    description: answers[`description${action.name}`],
    detailDescription: answers[`detailDescription${action.name}`],
    actionPrompt: answers[`actionPrompt${action.name}`],
  }));

  console.log(agentYamlObj)
  return
  
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
