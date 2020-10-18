const Translator = require('../lib/translator/translate');

module.exports = {
    /* language translations */
    initTranslator: Translator.initTranslator,
    translateText: Translator.translateText,
    find_in_dictionary: Translator.find_in_dictionary,
    saveDictionary: Translator.saveDictionary,
    add_to_dictionary: Translator.add_to_dictionary
};
