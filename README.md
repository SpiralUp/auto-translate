# Auto-translate

Translate texts to different languages using local dictionaries or the Google/Microsoft translation API.  This package can be used during code generation (for example from JHipster) to create language translations.  The Google/Microsoft translation API is used if the translation is not found in the local dictionary.  After a term is translated with the Google/Microsoft API, the translation is saved to the local dictionary.  Translations in the local dictionary can be manually edited.

The local dictionaries are defined on two levels: on the global and on the project level.  The project level dictionary contains project specific translations, and the global dictionary contains translations used in all projects.  Text translation is first searched in the project dictionary.  If it is not found there, then the global dictionary is searched, and if the translation does not exist in the global dictionary then the cloud translation API is used.  If the translation is found through the cloud API, the translated term is saved in both the project and the global dictionary. 

The local dictionary contains translation data in the json format that can be managed through a text editor. 

At the beginning of the translation process dictionaries are loaded from disk.  To initiate the translator and load the dictionaries from disk the method *Translator.initTranslator()* should be called. 

To translate a text from one language to another the function *Translator.translateText('text to be translated', 'text to be translated', 'en', 'es')* should be called.  The first parameter in the function call is the key under which this translation is saved in dictionaries and the second parameter is the actual text to translate.  Usually the first and the second parameters are the same, but there is some flexibility in this approach. During the translation session this function can be called multiple times. 

After the translation session is finished, to persist the translations (including any new translations obtained through the APIs) on the disk, the method *Translator.saveDictionary()* should be called. 

## Installation

    npm install auto-translate

## Configuration

Before using *auto-translate*, you have to configure it.

Configuration is defined in the **config file**.  The configuration is by default put in the user's home directory in the **.auto-translate/.auto-translate-config.json** file. If the configuration file does not exist, it will be created with the default values.  


Config file **.auto-translate-config.json** with default values:

    {
        "automaticTranslation": false,
        "translatorProvider": "google",
        "azureTranslateKey": "please-enter-the-key",
        "googleTranslateKey": "please-enter-the-key"
    }

#### Config file options
- **automaticTranslation** [true || false]: if automatic translation is true, then auto-translate will use cloud API for translation of text not found in dictionaries, otherwise the translation will use only local dictionaries for the translation.  Default value is **false**.
- **translationProvider** [azure || google]: define which translation provider will be used.  Default value is **google**.
- **azureTranslateKey**: API key from Azure
- **googleTranslateKey**: API key from Google

Config file **.auto-translate-config.json** configured to use Google API:

    {
        "automaticTranslation": true,
        "translatorProvider": "google",
        "azureTranslateKey":  "please-enter-the-key",
        "googleTranslateKey": "AIfghUJhhdijhguihd_0DGTkjhg87897jsdh77I"             
    }

*The Google key is just an example.*

Config file **.auto-translate-config.json** configured to use Azure API:

    {
        "automaticTranslation": true,
        "translatorProvider": "azure",
        "azureTranslateKey":  "8d349587aaddfff77466488499388e77",
        "googleTranslateKey": "please-enter-the-key"             
    }

*The Azure key is just an example.*

## Usage 


### 1. Configure translations

As described in the previous chapter, you must configure the translation first through config files.



### 2. Initialize translations

Before using the auto-translate package, you must initialize *auto-translate* with paths and file names.

    Translator.initTranslator(
        {
            pathToGlobalConfig: USER_HOME_FOLDER,
            configFileName: AUTO_TRANSLATE_CONFIG_FILE,
            pathToGlobalDictionary: USER_HOME_FOLDER,
            globalDictFileName: GLOBAL_DICTIONARY_FILE,
            pathToProject: PROJECT_FOLDER,
            projectDictFileName: PROJECT_DICTIONARY_FILE
        }
    ); 

- **pathToGlobalConfig**: (optional) path to the folder containing configuration file(s).  If not defined, config folder will be created in the user home **.auto-translate** directory.
- **configFileName**: (optional) name of the config file. If this parameter is not defined, the default name will be **.auto-translate-config.json**.
- **pathToGlobalDictionary**: (optional) path to the directory with the global dictionary.  If this path is not defined, global config path will also be used  for the global dictionary.
- **globalDictFileName**: (optional) name of the global dictionary file, the default name is **.global-dictionary.json**.
- **pathToProject**: (optional) path to the project directory.  If *pathToProject* is not defined, then the project dictionary will not be used.
- **projectDictFileName**: (optional) name of the project dictionary file. Default name is **.project-dictionary.json**.



### 3. Translate text

To translate a text from one language to another use the **translateText** function.

    let translationPromise = Translator.translateText('translation', 'translation','en','es');

    translationPromise.then(translation => {
        console.log('Translation -> ' + translation);
    }, reason => {
        console.log('Rejected -> ' + reason);
    })

Function **translateText** is defined as **translateText(key, textToTranslate, fromLang, toLang)**
 * @param **key** - the key that will be used to search in local dictionaries.  Usually this is equal to the text that needs to be translated, but could also be some form of expression.
 * @param **textToTranslate** - text that needs to be translated from one language to another
 * @param **fromLang** - language from which the text is translated
 * @param **toLang** - language to which the text is translated

The function returns a **promise**.

### 4. Save dictionaries

To save translations in local and project dictionaries, you should call the **saveDictionary** method.

    Translator.saveDictionary();
    
## Dependencies

This package depends on the following packages: *mstranslator*, *google-translate*, *lodash*, *nconf*, *promise*.
