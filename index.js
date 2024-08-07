#!/usr/bin/env node

// Usage: npx create-codebolt-agent my-app

const spawn = require('cross-spawn');
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const inquirer = require('inquirer');
const yaml = require('js-yaml');
const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');
const program = new Command();
program.option('-n, --name <name>', 'name of the project');
program.parse(process.argv);


const options = program.opts();
let projectName = '';
projectName = options.name || process.argv[2];

// Get the list of available templates
const templateDir = path.resolve(__dirname, 'template');
const templates = fs.readdirSync(templateDir).filter(file => fs.statSync(path.join(templateDir, file)).isDirectory());

const agentymlpath = path.join(__dirname, 'template/basic', 'codeboltagent.yaml');
let agentYamlData = fs.readFileSync(agentymlpath, 'utf8');

// Parse the YAML file
const parsedYaml = yaml.load(agentYamlData);

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
    message: 'Please enter the unique_id:',
    default: projectName.replace(/[^a-zA-Z0-9]/g, ''),
    validate: function (input) {
      if (/\s/.test(input)) {
        return 'unique_id should not contain any spaces';
      }
      return true;
    }
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
    type: 'input',
    name: 'tags',
    message: 'Please Enter agent tags by comma separated:',
    default: 'test',
  },
  {
    type: 'confirm',
    name: 'worksonblankcode',
    message: 'Works on blank code:',
    default: parsedYaml.metadata.agent_routing.worksonblankcode,
  },
  {
    type: 'confirm',
    name: 'worksonexistingcode',
    message: 'Works on existing code:',
    default: parsedYaml.metadata.agent_routing.worksonexistingcode,
  },
  {
    type: 'checkbox',
    name: 'supportedlanguages',
    message: 'Supported Languages:',
    choices: parsedYaml.metadata.agent_routing.supportedlanguages,
    validate: function (input) {
      if (input.length === 0) {
        return 'You must select at least one language';
      }
      return true;
    }
  },
  {
    type: 'checkbox',
    name: 'supportedframeworks',
    message: 'Supported Frameworks:',
    choices: parsedYaml.metadata.agent_routing.supportedframeworks,
    validate: function (input) {
      if (input.length === 0) {
        return 'You must select at least one framework';
      }
      return true;
    }
  },
];

async function askForActions(actionsData) {
  const initialPrompt = [
    {
      type: 'confirm',
      name: 'addActions',
      message: 'Do you want to add actions?',
      default: true,
    }
  ];

  const initialRes = await inquirer.prompt(initialPrompt);
  let addMoreActions = initialRes.addActions;

  while (addMoreActions) {
    const actionPrompt = [
      {
        type: 'input',
        name: 'actionName',
        message: 'Please Enter Action Name:',
        default: parsedYaml.actions[0].name
      },
      {
        type: 'input',
        name: 'description',
        message: 'Please Enter Action Description:',
        default: parsedYaml.actions[0].description
      },
      {
        type: 'input',
        name: 'detailDescription',
        message: 'Please Enter Detail Description (optional):',
        default: parsedYaml.actions[0].detailDescription,
      },
      {
        type: 'input',
        name: 'actionPrompt',
        message: 'Please Enter Action Prompt (optional):',
        default: parsedYaml.actions[0].actionPrompt,
      },
      {
        type: 'confirm',
        name: 'addMoreActions',
        message: 'Do you want to add more actions?',
        default: false,
      }
    ];

    const actionRes = await inquirer.prompt(actionPrompt);
    actionsData.push({
      name: actionRes.actionName,
      description: actionRes.description,
      detailDescription: actionRes.detailDescription,
      actionPrompt: actionRes.actionPrompt,
    });
    addMoreActions = actionRes.addMoreActions;
  }
  return actionsData;
}

async function askForInstructions(sdlc) {
  let addMoreInstructions = true;

  while (addMoreInstructions) {
    // Prompt for SDLC step name
    const stepPrompt = [
      {
        type: 'list',
        name: 'name',
        message: 'Please Enter SDLC Step Name:',
        choices: parsedYaml.metadata.sdlc_steps_managed.map(item => item.name),
      }
    ];

    const stepRes = await inquirer.prompt(stepPrompt);

    let instructions = [];

    // Prompt for multiple instructions
    let addMoreExamples = true;
    while (addMoreExamples) {
      const instructionPrompt = [
        {
          type: 'input',
          name: 'example_instruction',
          message: 'Please Enter Instruction Description:',
          default: 'Generate a new React component',
        },
        {
          type: 'confirm',
          name: 'addMoreExamples',
          message: 'Do you want to add another instruction?',
          default: false,
        }
      ];

      const instructionRes = await inquirer.prompt(instructionPrompt);
      
      instructions.push(instructionRes.example_instruction);
      addMoreExamples = instructionRes.addMoreExamples;
    }

    sdlc.push({
      name: stepRes.name,
      example_instructions: instructions,
    });

    const addMoreStepsPrompt = [
      {
        type: 'confirm',
        name: 'addMoreInstructions',
        message: 'Do you want to add more SDLC steps?',
        default: false,
      }
    ];

    const addMoreStepsRes = await inquirer.prompt(addMoreStepsPrompt);
    addMoreInstructions = addMoreStepsRes.addMoreInstructions;
  }

  return sdlc;
}

console.log(chalk.blue(
"  _____           _      _           _ _    \n"+
" /  __ \\         | |    | |         | | |   \n"+
" | /  \\/ ___   __| | ___| |__   ___ | | |_  \n"+
" | |    / _ \\ / _` |/ _ \\ '_ \\ / _ \\| | __| \n"+
" | \\__/\\ (_) | (_| |  __/ |_) | (_) | | |_  \n"+
"  \\____/\\___/ \\__,_|\\___|_.__/ \\___/|_|\\__| \n"));



  
  inquirer.prompt(prompts).then(async answers => {
    let sdlc = [];
    let actionsData = [];
    console.log(chalk.yellow(`\n------------------------------SDLC Steps-----------------------------------------\n`));
    console.log(chalk.green("SDLC Steps are the software development steps that your Agent will handle like code generation, deployment, testing etc. \n These are used by Universal Agent Router to route the user request to the correct Agent Invocation.\n Also add sample Instructions that the user should give to invoke that SLDC Step functionality.\n"));
    let sdlcInstruction  = await askForInstructions(sdlc)
    console.log(chalk.yellow(`\n------------------------------Action Steps-----------------------------------------\n`));
    console.log(chalk.green("Actions are the functionality that your Agent provides to the user. These are like functionality shortcuts that the user can invoke using \\ command.\n"));
    let actions = await askForActions(actionsData)


    projectName = answers.projectName.trim();
    const installPath = answers.installPath.trim() === '.' ? process.cwd() : path.resolve(process.cwd(), answers.installPath.trim());
    const selectedTemplate = answers.template;
    answers.sdlc_steps_managed = sdlcInstruction
    answers.actions = actions
    createProject(projectName, installPath, selectedTemplate, answers);
  });


function createProject(projectName, installPath, selectedTemplate, answers ) {
  
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
  agentYamlObj.tags = answers.tags.split(',').map(tag => tag.trim());
  agentYamlObj.unique_id = answers.unique_id
  agentYamlObj.metadata.agent_routing = {
    worksonblankcode: answers.worksonblankcode,
    worksonexistingcode: answers.worksonexistingcode,
    supportedlanguages: answers.supportedlanguages,
    supportedframeworks: answers.supportedframeworks,
  };

  agentYamlObj.metadata.sdlc_steps_managed = answers.sdlc_steps_managed.map(step => ({
    name: step.name,
    example_instructions: step.example_instructions,
  }));

  agentYamlObj.actions = parsedYaml.actions.map(action => ({
    name: action.name,
    description: action.description,
    detailDescription: action.detailDescription,
    actionPrompt: action.actionPrompt,
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
