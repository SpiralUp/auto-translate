/**
 * Auto Translate - set of functions for automatic translation between languages.
 *
 * Use local dictionaries or cloud providers for translation.
 * Local dictionary can be project based or global.
 * For terms not found in local dictionary, google or azure API is used.
 *
 * Created by Ivan Vrbovcan on 19.9.2020
 *
 */

module.exports = {
    initTranslator,
    translateText,
    findInDictionary,
    saveDictionary,
    addToDictionary,
    getConfig
};

const MsTranslator = require('mstranslator');
const fs = require('fs');
const path = require('path');
const nconf = require('nconf');
const Promise = require('promise');
const _ = require('lodash');

// Default file names
const AUTO_TRANSLATE_CONFIG_FILE = '.auto-translate-config.json';
const AUTO_TRANSLATE_USER_HOME_FOLDER = '.auto-translate';
const GLOBAL_DICTIONARY_FILE = '.global-dictionary.json';
const PROJECT_DICTIONARY_FILE = '.project-dictionary.json';

// Global vars and their default values
let confFile = path.normalize(path.join(getUserHome(), AUTO_TRANSLATE_CONFIG_FILE));
let globalDictFile = path.normalize(path.join(getUserHome(), GLOBAL_DICTIONARY_FILE));
let projectDictFile = '';
let useProjectDict = false;
let dictionary = {};
let projectDict = {};
let additionsToDictionary = 0;
let azureTranslateKey;
let _automaticTranslate = false;
let _dictionaryIsOpen = false;
let _projectDictIsOpen = false;
let translatorProvider = 'google';
let azureClient;
let googleTranslateKey;
let googleTranslateClient;

/**
 * Initialize translator with paths and file names
 *
 * @param translatorConfig:Object = {
 *     pathToGlobalConfig: path to folder that contains config and the global dictionary, if not defined, user folder will be used
 *     configFileName: name of the config file, if not defined, .auto-translate-config.json will be used
 +     pathToGlobalDictionary: path to global dictionary: if not defined, path to global config files will be used
 *     globalDictFileName: name of the global dictionary file, if not defined, .global-dictionary.json' will be used
 *     pathToProject: path to the project, if not defined the project dict will not be used
 *     projectDictFileName: name of the project dictionary file, if not defined, .project-dictionary.json will be used
 * }
 */
function initTranslator(translatorConfig) {
    let pathToGlobalConfig = null;
    let configFileName = null;
    let pathToGlobalDictionary = null;
    let globalDictFileName = null;
    let pathToProject = null;
    let projectDictFileName = null;

    if (translatorConfig) {
        pathToGlobalConfig = translatorConfig.pathToGlobalConfig;
        configFileName = translatorConfig.configFileName;
        pathToGlobalDictionary = translatorConfig.pathToGlobalDictionary;
        globalDictFileName = translatorConfig.globalDictFileName;
        pathToProject = translatorConfig.pathToProject;
        projectDictFileName = translatorConfig.projectDictFileName;
    }
    pathToGlobalConfig = pathToGlobalConfig || getUserHome();
    pathToGlobalDictionary = pathToGlobalDictionary || pathToGlobalConfig;
    configFileName = configFileName || AUTO_TRANSLATE_CONFIG_FILE;
    globalDictFileName = globalDictFileName || GLOBAL_DICTIONARY_FILE;
    confFile = path.normalize(path.join(pathToGlobalConfig, configFileName));
    globalDictFile = path.normalize(path.join(pathToGlobalDictionary, globalDictFileName));

    createConfigIfNotExist(confFile);
    createDictionaryIfNotExist(globalDictFile);
    initGlobalDictionary(globalDictFile);

    useProjectDict = !!pathToProject;

    if (useProjectDict) {
        projectDictFile = path.normalize(path.join(pathToProject, projectDictFileName || PROJECT_DICTIONARY_FILE));
        createDictionaryIfNotExist(projectDictFile);
        initProjectDictionary(projectDictFile);
    }

    nconf.file(confFile);
    azureTranslateKey = nconf.get('azureTranslateKey');
    googleTranslateKey = nconf.get('googleTranslateKey');
    translatorProvider = nconf.get('translatorProvider'); // the other option is 'azure'

    _automaticTranslate = nconf.get('automaticTranslation') || false;
    // console.log(`automatic translate:${_automaticTranslate}`);
    // console.log(`Translator provider=${translatorProvider}`);

    if (translatorProvider === 'azure') {
        azureClient = new MsTranslator(
            {
                api_key: azureTranslateKey // use this for the new token API.
            },
            true
        );
    }

    if (translatorProvider === 'google') {
        googleTranslateClient = require('google-translate')(googleTranslateKey, 5);
    }
}

/**
 * Helper function to get the auto-translate current config.  This is used through unit tests.
 *
 * @returns {{globalDict: {}, automaticTranslation: boolean, useProjectDict: boolean, confFile: string, projectDict: {}, projectDictFile: string, globalDictFile: string, translatorProvider: string}}
 */
function getConfig() {
    return {
        confFile,
        globalDictFile,
        useProjectDict,
        projectDictFile,
        translatorProvider,
        automaticTranslation: _automaticTranslate,
        globalDict: dictionary,
        projectDict
    };
}

/**
 * Check if the file exists
 *
 * @param filePath
 * @returns {boolean}
 */
function doesFileExist(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (error) {
        return false;
    }
}

/**
 * Check if the folder exists
 *
 * @param filePath
 * @returns {boolean}
 */
function doesFolderExist(filePath) {
    try {
        return fs.statSync(filePath).isDirectory();
    } catch (error) {
        return false;
    }
}

/**
 * Create the config file with default parameters if the file does not exists.
 *
 * @param confFile
 */
function createConfigIfNotExist(confFile) {
    // check confFile
    if (!doesFileExist(confFile)) {
        const fileContent = {
            automaticTranslation: false,
            translatorProvider: 'google',
            azureTranslateKey: 'please-enter-the-key',
            googleTranslateKey: 'please-enter-the-key'
        };
        // console.log(`Creating file ${confFile}`);
        fs.writeFileSync(confFile, JSON.stringify(fileContent, null, 4));
    }
}

/**
 * Create the dictionary file if the specified file does not exists.
 *
 * @param dictFile
 */
function createDictionaryIfNotExist(dictFile) {
    if (!doesFileExist(dictFile)) {
        const fileContent = {};
        fs.writeFileSync(dictFile, JSON.stringify(fileContent, null, 4));
        // console.log(`Creating file${dictFile}`);
    }
}

/**
 * Initialize global dictionary from specified file
 *
 * @param globalDictFilePath
 */
function initGlobalDictionary(globalDictFilePath) {
    dictionary = {};
    additionsToDictionary = 0;
    dictionary = readDictionaryFile(globalDictFilePath);
    if (!dictionary) {
        dictionary = {};
        _dictionaryIsOpen = false;
    } else {
        _dictionaryIsOpen = true;
    }
}

/**
 * Initialize project dictionary form specified file
 *
 * @param projectDictFilePath
 */
function initProjectDictionary(projectDictFilePath) {
    projectDict = {};
    projectDict = readDictionaryFile(projectDictFilePath);
    if (!projectDict) {
        projectDict = {};
        _projectDictIsOpen = false;
    } else {
        _projectDictIsOpen = true;
    }
}

/**
 * Getter for the isAutomaticTranslation - if this is true, the package will translate text from one language to another.
 *
 * @returns {boolean}
 */
function isAutomaticTranslation() {
    return _automaticTranslate;
}

/**
 * Read the dictionary from the file
 *
 * @param dictPath
 * @returns {undefined|any}
 */
function readDictionaryFile(dictPath = globalDictFile) {
    try {
        return JSON.parse(fs.readFileSync(dictPath));
    } catch (error) {
        // console.log(`Cannot open ${dictPath}`);
        _automaticTranslate = false;
        return undefined;
    }
}

/**
 * Write the dictionary to the file
 *
 * @param dictionaryPath
 * @param dictionaryName
 */
function writeDictionaryFile(dictionaryPath = globalDictFile, dictionaryName = dictionary) {
    // console.log('Saving dictionary...');
    fs.writeFileSync(dictionaryPath, JSON.stringify(dictionaryName, null, 4));
}

/**
 * Translate text with the Azure API
 *
 * @param cKey
 * @param cPhrase
 * @param cFromLang
 * @param cToLang
 * @returns {Promise<string>}
 */
function azureTranslate(cKey, cPhrase, cFromLang, cToLang) {
    return new Promise(function(resolve, reject) {
        if (azureTranslateKey) {
            const params = {
                text: cPhrase,
                from: cFromLang,
                to: cToLang
            };

            // Don't worry about access token, it will be auto-generated if needed.

            azureClient.translate(params, function(err, data) {
                if (data) {
                    addToDictionary(cKey, data, cFromLang, cToLang);
                    resolve(data);
                } else if (err) {
                    reject(new Error(`${err} Translate_key:${azureTranslateKey}`));
                }
            });
        } else {
            reject(new Error('Please provide Azure credentials...'));
        }
    });
}

/**
 * Translate text with the Google API
 *
 * @param cKey
 * @param cPhrase
 * @param cFromLang
 * @param cToLang
 * @returns {Promise<string>}
 */
function googleTranslate(cKey, cPhrase, cFromLang, cToLang) {
    return new Promise(function(resolve, reject) {
        // Don't worry about access token, it will be auto-generated if needed.
        googleTranslateClient.translate(cPhrase, cFromLang, cToLang, function(err, data) {
            if (data) {
                addToDictionary(cKey, data.translatedText, cFromLang, cToLang);
                resolve(data);
            } else if (err) {
                reject(err);
            }
        });
    });
}

/**
 * Find text in local dictionaries.
 * If the project dictionary is enabled, the text is first tried to be found there.
 * if the text is not found in the project dictionary, then the global dictionary is used.
 *
 * @param text
 * @param fromLang
 * @param toLang
 * @returns {undefined|*}
 */
function findInDictionary(text, fromLang, toLang) {
    const langKey = `${fromLang}_${toLang}`;

    if (useProjectDict && _projectDictIsOpen) {
        if (!_.isUndefined(projectDict[langKey])) {
            if (!_.isUndefined(projectDict[langKey][text])) {
                return projectDict[langKey][text];
            }
        }
    }

    if (_dictionaryIsOpen && !_.isUndefined(dictionary[langKey])) {
        if (_.isUndefined(dictionary[langKey][text])) {
            return undefined;
        }
        return dictionary[langKey][text];
    }
    return undefined;
}

/**
 * Add text to dictionaries.
 *
 * @param text
 * @param translation
 * @param fromLang
 * @param toLang
 */
function addToDictionary(text, translation, fromLang, toLang) {
    const langKey = `${fromLang}_${toLang}`;
    // console.log(`  addToDictionary(${text}, ${translation}, ${fromLang}, ${toLang})`);
    if (_.isUndefined(dictionary[langKey])) {
        dictionary[langKey] = {};
    }
    if (_.isUndefined(dictionary[langKey][text])) {
        additionsToDictionary++;
    }
    if (!_.startsWith(translation, 'ArgumentException:', 0)) {
        dictionary[langKey][text] = translation;

        if (useProjectDict) {
            if (_.isUndefined(projectDict[langKey])) {
                projectDict[langKey] = {};
            }
            projectDict[langKey][text] = translation;
        }
    }
}

/** *
 * Translate text from one language to other language
 * @param key - the key that will be used to search in local dictionaries.  Usually this is equal to
 *              the text that needs to be translated, but could also be some expression.
 * @param textToTranslate - text that needs to be translated from one language to the other one
 * @param fromLang - language from which the text is translated
 * @param toLang - language to which the text is translated
 * @returns {Promise<string>}
 */
function translateText(key, textToTranslate, fromLang, toLang) {
    return new Promise(function(resolve, reject) {
        const t = findInDictionary(key, fromLang, toLang);
        if (!t) {
            if (isAutomaticTranslation()) {
                if (translatorProvider === 'azure') {
                    azureTranslate(key, textToTranslate, fromLang, toLang).then(
                        function(result) {
                            // console.log(`azureTranslate(${key}, ${fromLang}, ${toLang})=${result}`);
                            resolve(result);
                        },
                        function(error) {
                            reject(error);
                        }
                    );
                } else if (translatorProvider === 'google') {
                    googleTranslate(key, textToTranslate, fromLang, toLang).then(
                        function(result) {
                            // console.log(`googleTranslate(${key}, ${fromLang}, ${toLang})=${result}`);
                            resolve(result);
                        },
                        function(error) {
                            reject(error);
                        }
                    );
                } else {
                    resolve(undefined);
                }
            } else {
                reject(new Error('Automatic translation is not enabled'));
            }
        } else {
            // console.log(`findInDictionary(${key}, ${fromLang}, ${toLang})=${t}`);
            resolve(t);
        }
    });
}

/**
 * Save global and project dictionaries
 */
function saveDictionary() {
    // console.log(`saveDictionary, additionsToDictionary=${additionsToDictionary}`);
    if (additionsToDictionary > 0) {
        writeDictionaryFile(globalDictFile, dictionary);
        if (useProjectDict) {
            writeDictionaryFile(projectDictFile, projectDict);
        }
        additionsToDictionary = 0;
    }
}

/**
 * Get user home directory
 *
 * @returns {string}
 */
function getUserHome() {
    let homeFolder = process.env.HOME || process.env.USERPROFILE;
    homeFolder = `${homeFolder}/${AUTO_TRANSLATE_USER_HOME_FOLDER}`;

    if (!doesFolderExist(homeFolder)) {
        fs.mkdirSync(homeFolder);
    }

    return homeFolder;
}
