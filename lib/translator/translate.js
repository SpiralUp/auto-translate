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

let googleServiceAccountFile;

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
    googleServiceAccountFile = nconf.get('googleServiceAccountFile');
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
        const { Translate } = require('@google-cloud/translate').v2;
        if (!googleServiceAccountFile) {
            throw new Error('googleServiceAccountFile must be configured for Google translation');
        }
        googleTranslateClient = new Translate({
            keyFilename: googleServiceAccountFile
        });
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
            googleServiceAccountFile: '/path/to/service-account-key.json'
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
    const dir = path.dirname(dictFile);
    if (!doesFolderExist(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Creating folder ${dir}`);
    }
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
    return new Promise(function (resolve, reject) {
        if (azureTranslateKey) {
            const params = {
                text: cPhrase,
                from: cFromLang,
                to: cToLang
            };

            // Don't worry about access token, it will be auto-generated if needed.

            azureClient.translate(params, function (err, data) {
                if (data) {
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
    return new Promise((resolve, reject) => {
        googleTranslateClient
            .translate(cPhrase, { from: cFromLang, to: cToLang })
            .then(([translation]) => {
                resolve(translation);
            })
            .catch(err => {
                reject(err);
            });
    });
}

/**
 * Find text in local dictionaries.
 * If the project dictionary is enabled, the text is first tried to be found there.
 * if the text is not found in the project dictionary, then the global dictionary is used.
 *
 * @param {string} key - The key that will be used to search in local dictionaries. Usually this is equal to the text that needs to be translated, but could also be some expression.
 * @param {string} textToBeTranslated - The text that was translated.
 * @param {string} fromLang - The language from which the text is translated.
 * @param {string} toLang - The language to which the text is translated.
 * @returns {undefined|*}
 */
function findInDictionary(key, textToBeTranslated, fromLang, toLang) {
    const langKey = `${fromLang}_${toLang}`;
    const nativeLangKey = `${fromLang}_${fromLang}`;
    let translation;
    let foundInProjectDict = false;
    let foundInGlobalDict = false;

    if (useProjectDict && _projectDictIsOpen) {
        if (!_.isUndefined(projectDict[langKey]) && !_.isUndefined(projectDict[langKey][key])) {
            translation = projectDict[langKey][key];
            foundInProjectDict = true;
            return { translation, foundInProjectDict, foundInGlobalDict };
        }
    }

    if (_dictionaryIsOpen && !_.isUndefined(dictionary[langKey]) && !_.isUndefined(dictionary[langKey][key])) {
        translation = dictionary[langKey][key];
        foundInGlobalDict = true;

        // If not found in project dictionary, add it
        if (useProjectDict && !foundInProjectDict) {
            addToProjectDictionary(langKey, nativeLangKey, key, textToBeTranslated, translation);
        }

        return { translation, foundInProjectDict, foundInGlobalDict };
    }

    return { translation: undefined, foundInProjectDict, foundInGlobalDict };
}

/**
 * Adds a translation to the project-specific dictionary.
 *
 * This function checks if the project dictionary is being used (`useProjectDict` flag).
 * If so, it then checks if there's an existing entry for the language pair (`langKey`).
 * If there isn't, it initializes an empty object for that language pair.
 * Finally, it adds the translation for the specified text.
 *
 * @param {string} langKey - The language pair key, formatted as 'fromLang_toLang'.
 * @param {string} nativeLangKey - The native language pair key, formatted as 'fromLang_fromLang'.
 * @param {string} key - The key used to store the translation.
 * @param {string} textToBeTranslated - The text that was translated.
 * @param {string} translation - The translated text.
 */
function addToProjectDictionary(langKey, nativeLangKey, key, textToBeTranslated, translation) {
    if (useProjectDict) {
        if (_.isUndefined(projectDict[langKey])) {
            projectDict[langKey] = {};
        }
        if (_.isUndefined(projectDict[nativeLangKey])) {
            projectDict[nativeLangKey] = {};
        }
        if (_.isUndefined(projectDict[langKey][key])) {
            projectDict[langKey][key] = translation;
            additionsToDictionary++;
        }
        if (_.isUndefined(projectDict[nativeLangKey][key])) {
            projectDict[nativeLangKey][key] = textToBeTranslated;
            additionsToDictionary++;
        }
    }
}

/**
 * Add text to dictionaries.
 *
 * @param key
 * @param translation
 * @param fromLang
 * @param toLang
 */
function addToDictionary(key, textToTranslate, translation, fromLang, toLang, addToGlobal = true, addToProject = true) {
    const langKey = `${fromLang}_${toLang}`;
    const selfLangKey = `${fromLang}_${fromLang}`;

    if (!_.startsWith(translation, 'ArgumentException:', 0)) {
        if (addToGlobal) {
            if (_.isUndefined(dictionary[selfLangKey])) {
                dictionary[selfLangKey] = {};
            }
            if (_.isUndefined(dictionary[langKey])) {
                dictionary[langKey] = {};
            }
            if (_.isUndefined(dictionary[selfLangKey][key])) {
                dictionary[selfLangKey][key] = textToTranslate;
                additionsToDictionary++;
            }
            if (_.isUndefined(dictionary[langKey][key])) {
                dictionary[langKey][key] = translation;
                additionsToDictionary++;
            }
        }

        if (addToProject && useProjectDict) {
            if (_.isUndefined(projectDict[selfLangKey])) {
                projectDict[selfLangKey] = {};
            }
            if (_.isUndefined(projectDict[langKey])) {
                projectDict[langKey] = {};
            }
            if (_.isUndefined(projectDict[selfLangKey][key])) {
                projectDict[selfLangKey][key] = textToTranslate;
                additionsToDictionary++;
            }
            if (_.isUndefined(projectDict[langKey][key])) {
                projectDict[langKey][key] = translation;
                additionsToDictionary++;
            }
        }
    }
}

/** *
 * Translate text from one language to other language
 * @param key - the key that will be used to search in local dictionaries.  Usually this is equal to
 *              the text that needs to be translated, but could also be some expression.
 *              The key is case sensitive. The caller should take care of the case.
 * @param textToTranslate - text that needs to be translated from one language to the other one
 * @param fromLang - language from which the text is translated
 * @param toLang - language to which the text is translated
 * @returns {ThenPromise<unknown> | ThenPromise}
 */
function translateText(key, textToTranslate, fromLang, toLang) {
    return new Promise(function (resolve, reject) {
        // key = key.toLowerCase().trim();
        key = key.trim(); // key is case sensitive - the caller should take care of the case
        const {
            translation: t,
            foundInProjectDict,
            foundInGlobalDict
        } = findInDictionary(key, textToTranslate, fromLang, toLang);
        const addToGlobal = !foundInGlobalDict;
        const addToProject = !foundInProjectDict;

        if (!t) {
            if (isAutomaticTranslation()) {
                const handleTranslationResult = translation => {
                    addToDictionary(key, textToTranslate, translation, fromLang, toLang, addToGlobal, addToProject);
                    resolve(translation);
                };

                if (translatorProvider === 'azure') {
                    azureTranslate(key, textToTranslate, fromLang, toLang).then(
                        handleTranslationResult,
                        function (error) {
                            reject(error);
                        }
                    );
                } else if (translatorProvider === 'google') {
                    googleTranslate(key, textToTranslate, fromLang, toLang).then(
                        handleTranslationResult,
                        function (error) {
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
