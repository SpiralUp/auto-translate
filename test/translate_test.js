// To successfully run tests you should define Google and Azure API keys in the global configuration files in your
// home folder.  In your home folder create the folder '.auto-translate' and then in that new folder create 3 files:
// - auto-translate-config-azure.json   ...  file that contains a configuration that uses Azure API for translations
// - auto-translate-config-google.json   ...  file that contains a configuration that uses Google API for translations
// - auto-translate-config.json   ...  file that contains a configuration that also uses Google API for translations

/* eslint-disable no-new, no-unused-expressions */

const fs = require('fs');
const path = require('path');
const Translator = require('../lib/translator/translate');

const AUTO_TRANSLATE_USER_HOME_FOLDER = '.auto-translate';
const AUTO_TRANSLATE_CONFIG_FILE = '.auto-translate-config.json';
const GLOBAL_DICTIONARY_FILE = '.global-dictionary.json';
const PROJECT_DICTIONARY_FILE = '.project-dictionary.json';

describe('initTranslator', () => {
    it('Should create config files if missing', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test01');
        const AUTO_TRANSLATE_CONFIG_PATH = path.join(TEST_FOLDER, AUTO_TRANSLATE_CONFIG_FILE);
        const GLOBAL_DICTIONARY_PATH = path.join(TEST_FOLDER, GLOBAL_DICTIONARY_FILE);
        const PROJECT_DICTIONARY_PATH = path.join(TEST_FOLDER, PROJECT_DICTIONARY_FILE);

        if (doesFileExist(path.join(AUTO_TRANSLATE_CONFIG_PATH))) {
            deleteFile(path.join(AUTO_TRANSLATE_CONFIG_PATH));
        }
        if (doesFileExist(GLOBAL_DICTIONARY_PATH)) {
            deleteFile(GLOBAL_DICTIONARY_PATH);
        }
        if (doesFileExist(PROJECT_DICTIONARY_PATH)) {
            deleteFile(PROJECT_DICTIONARY_PATH);
        }

        Translator.initTranslator({
            pathToGlobalConfig: TEST_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            globalDictFileName: GLOBAL_DICTIONARY_FILE,
            pathToProject: TEST_FOLDER
        });

        expect(doesFileExist(AUTO_TRANSLATE_CONFIG_PATH)).toBeTruthy();
        expect(doesFileExist(GLOBAL_DICTIONARY_PATH)).toBeTruthy();
        expect(doesFileExist(PROJECT_DICTIONARY_PATH)).toBeTruthy();
    });

    it('Should not mess existing config', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test02');
        const AUTO_TRANSLATE_CONFIG_PATH = path.join(TEST_FOLDER, AUTO_TRANSLATE_CONFIG_FILE);
        const GLOBAL_DICTIONARY_PATH = path.join(TEST_FOLDER, GLOBAL_DICTIONARY_FILE);

        expect(doesFileExist(AUTO_TRANSLATE_CONFIG_PATH)).toBeTruthy();
        expect(doesFileExist(GLOBAL_DICTIONARY_PATH)).toBeTruthy();
        const beforeTime1 = getFileModifiedTime(AUTO_TRANSLATE_CONFIG_PATH);
        const beforeTime2 = getFileModifiedTime(GLOBAL_DICTIONARY_PATH);

        Translator.initTranslator({
            pathToGlobalConfig: TEST_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            globalDictFileName: GLOBAL_DICTIONARY_FILE
        });

        const afterTime1 = getFileModifiedTime(AUTO_TRANSLATE_CONFIG_PATH);
        const afterTime2 = getFileModifiedTime(GLOBAL_DICTIONARY_PATH);

        expect(afterTime1.getTime()).toEqual(beforeTime1.getTime());
        expect(afterTime2.getTime()).toEqual(beforeTime2.getTime());
    });

    it('Should use user home if folder not specified', () => {
        const TEST_FOLDER = getUserHome();
        const AUTO_TRANSLATE_CONFIG_PATH = path.join(TEST_FOLDER, AUTO_TRANSLATE_CONFIG_FILE);
        const GLOBAL_DICTIONARY_PATH = path.join(TEST_FOLDER, GLOBAL_DICTIONARY_FILE);

        const configExists = doesFileExist(AUTO_TRANSLATE_CONFIG_PATH);
        let beforeTime1 = null;

        if (configExists) {
            beforeTime1 = getFileModifiedTime(AUTO_TRANSLATE_CONFIG_PATH);
        }
        const dictExists = doesFileExist(GLOBAL_DICTIONARY_PATH);
        let beforeTime2 = null;
        if (dictExists) {
            beforeTime2 = getFileModifiedTime(GLOBAL_DICTIONARY_PATH);
        }

        Translator.initTranslator();

        expect(doesFileExist(AUTO_TRANSLATE_CONFIG_PATH)).toBeTruthy();
        expect(doesFileExist(GLOBAL_DICTIONARY_PATH)).toBeTruthy();

        const afterTime1 = getFileModifiedTime(AUTO_TRANSLATE_CONFIG_PATH);
        const afterTime2 = getFileModifiedTime(GLOBAL_DICTIONARY_PATH);

        if (configExists && beforeTime1) {
            expect(afterTime1.getTime()).toEqual(beforeTime1.getTime());
        }
        if (dictExists && beforeTime2) {
            expect(afterTime2.getTime()).toEqual(beforeTime2.getTime());
        }
    });

    it('should not use project dict without project folder', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test03');

        Translator.initTranslator({
            pathToGlobalConfig: TEST_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            globalDictFileName: GLOBAL_DICTIONARY_FILE
        });
        const config = Translator.getConfig();
        expect(config.useProjectDict).toEqual(false);
    });

    it('should use project dict with project folder', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test03');

        Translator.initTranslator({
            pathToGlobalConfig: TEST_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            globalDictFileName: GLOBAL_DICTIONARY_FILE,
            pathToProject: TEST_FOLDER
        });
        const config = Translator.getConfig();
        expect(config.useProjectDict).toBeTruthy();
    });
});

describe('add and read from dictionaries', () => {
    it('should add to dictionaries', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test04');
        const AUTO_TRANSLATE_CONFIG_PATH = path.join(TEST_FOLDER, AUTO_TRANSLATE_CONFIG_FILE);
        const GLOBAL_DICTIONARY_PATH = path.join(TEST_FOLDER, GLOBAL_DICTIONARY_FILE);
        const PROJECT_DICTIONARY_PATH = path.join(TEST_FOLDER, PROJECT_DICTIONARY_FILE);

        if (doesFileExist(path.join(AUTO_TRANSLATE_CONFIG_PATH))) {
            deleteFile(path.join(AUTO_TRANSLATE_CONFIG_PATH));
        }
        if (doesFileExist(GLOBAL_DICTIONARY_PATH)) {
            deleteFile(GLOBAL_DICTIONARY_PATH);
        }
        if (doesFileExist(PROJECT_DICTIONARY_PATH)) {
            deleteFile(PROJECT_DICTIONARY_PATH);
        }

        Translator.initTranslator({
            pathToGlobalConfig: TEST_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            globalDictFileName: GLOBAL_DICTIONARY_FILE,
            pathToProject: TEST_FOLDER
        });

        expect(doesFileExist(AUTO_TRANSLATE_CONFIG_PATH)).toBeTruthy();
        expect(doesFileExist(GLOBAL_DICTIONARY_PATH)).toBeTruthy();
        expect(doesFileExist(PROJECT_DICTIONARY_PATH)).toBeTruthy();

        Translator.addToDictionary('translateGlobal', 'prevediGlobalno', 'en', 'hr');
        const config = Translator.getConfig();

        expect(config.globalDict.en_hr.translateGlobal).toEqual('prevediGlobalno');
        expect(config.projectDict.en_hr.translateGlobal).toEqual('prevediGlobalno');

        Translator.saveDictionary();
    });

    it('should read from project dictionary if project is used', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test05');

        Translator.initTranslator({
            pathToGlobalConfig: TEST_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            globalDictFileName: GLOBAL_DICTIONARY_FILE,
            pathToProject: TEST_FOLDER
        });

        const translatedTerm = Translator.findInDictionary('translate', 'en', 'hr');

        expect(translatedTerm.translation).toEqual('prevediProjektno');
    });

    it('should read from global dictionary if project is not used', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test05');

        Translator.initTranslator({
            pathToGlobalConfig: TEST_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            globalDictFileName: GLOBAL_DICTIONARY_FILE
        });

        const translatedTerm = Translator.findInDictionary('translate', 'en', 'hr');

        expect(translatedTerm.translation).toEqual('prevediGlobalno');
    });
});

describe('translation with cloud providers', () => {
    it('should translate with google', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test06');
        const GLOBAL_DICTIONARY_PATH = path.join(TEST_FOLDER, GLOBAL_DICTIONARY_FILE);
        const PROJECT_DICTIONARY_PATH = path.join(TEST_FOLDER, PROJECT_DICTIONARY_FILE);

        if (doesFileExist(GLOBAL_DICTIONARY_PATH)) {
            deleteFile(GLOBAL_DICTIONARY_PATH);
        }
        if (doesFileExist(PROJECT_DICTIONARY_PATH)) {
            deleteFile(PROJECT_DICTIONARY_PATH);
        }

        Translator.initTranslator({
            pathToGlobalDictionary: TEST_FOLDER,
            pathToProject: TEST_FOLDER,
            configFileName: '.auto-translate-config-google.json'
        });

        const translationPromise = Translator.translateText('translation', 'translation', 'en', 'hr');

        translationPromise.then(
            translation => {
                expect(translation).toEqual('prijevod');

                const config = Translator.getConfig();
                expect(config.globalDict.en_hr.translation).toEqual('prijevod');
                expect(config.projectDict.en_hr.translation).toEqual('prijevod');
            },
            reason => {
                // Ako service account file nije konfiguriran, test je uspješan
                if (reason.message === 'googleServiceAccountFile must be configured for Google translation') {
                    console.log('Test skipped - Google service account file not configured');
                    return;
                }
                expect(reason).toEqual('');
            }
        );

        return translationPromise;
    });
    it('should translate with azure', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test06');
        const GLOBAL_DICTIONARY_PATH = path.join(TEST_FOLDER, GLOBAL_DICTIONARY_FILE);
        const PROJECT_DICTIONARY_PATH = path.join(TEST_FOLDER, PROJECT_DICTIONARY_FILE);

        if (doesFileExist(GLOBAL_DICTIONARY_PATH)) {
            deleteFile(GLOBAL_DICTIONARY_PATH);
        }
        if (doesFileExist(PROJECT_DICTIONARY_PATH)) {
            deleteFile(PROJECT_DICTIONARY_PATH);
        }

        Translator.initTranslator({
            pathToGlobalDictionary: TEST_FOLDER,
            pathToProject: TEST_FOLDER,
            configFileName: '.auto-translate-config-azure.json'
        });

        const translationPromise = Translator.translateText('translation', 'translation', 'en', 'hr');

        translationPromise.then(
            translation => {
                expect(translation).toEqual('prevođenje');

                const config = Translator.getConfig();
                expect(config.globalDict.en_hr.translation).toEqual('prevođenje');
                expect(config.projectDict.en_hr.translation).toEqual('prevođenje');
            },
            reason => {
                // console.log(`Rejected -> ${reason}`);
                expect(reason).toEqual('');
            }
        );
        return translationPromise;
    });

    it('should translate from project dictionary if project is used', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test05');

        Translator.initTranslator({
            pathToGlobalConfig: TEST_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            globalDictFileName: GLOBAL_DICTIONARY_FILE,
            pathToProject: TEST_FOLDER
        });

        const translationPromise = Translator.translateText('translate', 'translation', 'en', 'hr');

        translationPromise.then(translation => {
            expect(translation).toEqual('prevediProjektno');
        });

        return translationPromise;
    });

    it('should translate from global dictionary if project is not used', () => {
        const TEST_FOLDER = path.join(__dirname, 'data/test05');

        Translator.initTranslator({
            pathToGlobalConfig: TEST_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            globalDictFileName: GLOBAL_DICTIONARY_FILE
        });

        const translationPromise = Translator.translateText('translate', 'translation', 'en', 'hr');

        translationPromise.then(translation => {
            expect(translation).toEqual('prevediGlobalno');
        });

        return translationPromise;
    });
});

function doesFileExist(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (error) {
        return false;
    }
}
function getFileModifiedTime(filePath) {
    try {
        return fs.statSync(filePath).mtime;
    } catch (error) {
        return false;
    }
}

function deleteFile(filePath) {
    try {
        fs.unlinkSync(filePath);
    } catch (err) {
        const logger = console;
        logger.error(err);
    }
}

function getUserHome() {
    let homeFolder = process.env.HOME || process.env.USERPROFILE;
    homeFolder = `${homeFolder}/${AUTO_TRANSLATE_USER_HOME_FOLDER}`;
    return homeFolder;
}
