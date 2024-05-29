#!/usr/bin/env node

// Usage: npx create-codebolt-agent my-app

const spawn = require('cross-spawn');
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const inquirer = require('inquirer');

const program = new Command();
program.option('-n, --name <name>', 'name of the project');
program.parse(process.argv);

const options = program.opts();
let projectName = '';
projectName = options.name || process.argv[2];

// Get the list of available templates
const templateDir = path.resolve(__dirname, 'template');
const templates = fs.readdirSync(templateDir).filter(file => fs.statSync(path.join(templateDir, file)).isDirectory());

inquirer.prompt([
  {
    type: 'input',
    name: 'projectName',
    message: 'Please enter the name of your application:',
    default: projectName
  },
  {
    type: 'input',
    name: 'installPath',
    message: 'Please enter the path to install the application:',
    default: projectName
  },
  {
    type: 'list',
    name: 'template',
    message: 'Please select a template for your application:',
    choices: templates
  }
]).then(answers => {
  projectName = answers.projectName.trim();
  const installPath = answers.installPath.trim() === '.' ? process.cwd() : path.resolve(process.cwd(), answers.installPath.trim());
  const selectedTemplate = answers.template;
  createProject(projectName, installPath, selectedTemplate);
});

function createProject(projectName, installPath, selectedTemplate) {
  // Create a project directory with the project name.
  const projectDir = path.resolve(installPath);
  fs.mkdirSync(projectDir, { recursive: true });

  // Copy the selected template to the project directory
  const templatePath = path.join(templateDir, selectedTemplate);
  fs.cpSync(templatePath, projectDir, { recursive: true });

  // It is good practice to have dotfiles stored in the
  // template without the dot (so they do not get picked
  // up by the starter template repository). We can rename
  // the dotfiles after we have copied them over to the
  // new project directory.
  fs.renameSync(
    path.join(projectDir, 'gitignore'),
    path.join(projectDir, '.gitignore')
  );

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
  spawn.sync('npm', ['install'], { stdio: 'inherit' });

  console.log('Success! Your new project is ready.');
  console.log(`Created ${projectName} at ${projectDir}`);
}
