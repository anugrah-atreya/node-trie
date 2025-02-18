'use strict';
const CONSTANT = require('./src/constants/trie');
const ErrorClass = require('./src/errors/trie');
const Node = require('./src/model/node');
const _ = require('lodash');
const Error = new ErrorClass();
const uniq = require('array-uniq');

class Trie {
    /**
     * Props {delimiter}
     * Delimiter supports String, Positive Integer and undefined.
     * Positive Integer : delimits provided data by number of character count.
     * String(s) : sets up as the that string or regex as the delimiter
     * undefined : treats '' as delimiter.
     * @param  props = { delimiter = 'str' || 1 || undefined }
     */
    constructor(props) {
        let delimiter = _.get(props, 'delimiter');
        if (delimiter) {
            this.has_delimiter = true;
            if (typeof delimiter === 'number') {
                delimiter = parseInt(delimiter);
                if (delimiter >= 1) {
                    this.delimeter_type = CONSTANT.COUNT_MATCH;
                    this.delimiter = delimiter;
                } else {
                    Error.invalidDelimiter(delimiter);
                }
            } else {
                this.delimiter = delimiter.toString();
                this.delimeter_type = CONSTANT.STR_MATCH;
            }
        } else {
            this.has_delimiter = false;
        }
        this.first_level_map = {};
        this.first_char_of_all_words = [];
    }

    wordCount() {
        return this.first_char_of_all_words.length;
    }

    longestCompoundWord() {
        const uniqueKeys = uniq(this.first_char_of_all_words);
        let longestStr = '';
        uniqueKeys.forEach(key => {
            const valuesforKey = this.nearMatch(key);
            // if there is only 1 result that means there are no compounded words
            if (valuesforKey.length > 1) {
                // remove the first word on which other compounds are based
                valuesforKey.splice(0, 1);
                valuesforKey.forEach(value => {
                    if (value.length > longestStr.length) {
                        longestStr = value;
                    }
                });
            }
        });
        return longestStr;
    }

    longestWord() {
        const uniqueKeys = uniq(this.first_char_of_all_words);
        let longestStr = '';
        uniqueKeys.forEach(key => {
            const valuesforKey = this.nearMatch(key);
            valuesforKey.forEach(value => {
                if (value.length > longestStr.length) {
                    longestStr = value;
                }
            });
        });
        return longestStr;
    }

    _getFirstLevelMap() {
        return this.first_level_map;
    }


    _hasDelimiter() {
        return this.has_delimiter;
    }

    _getDelimiterType() {
        return this.delimeter_type;
    }

    _getDelimiter() {
        return this.delimiter;
    }

    _addValueToNode(node, values) {
        if (_.isEmpty(values)) {
            node.markWord();
            node.increaseDependency();
            return;
        }
        if (node.getNode(values[0])) {
            return this._addValueToNode(node.getNode(values[0]), values.splice(1));
        } else {
            const newNode = new Node(values[0]);
            node.setNode(newNode);
            return this._addValueToNode(newNode, values.splice(1));
        }
    }

    add(value) {
        if (_.isEmpty(value)) {
            return;
        }
        value = _.toLower(value);
        let values = [];
        let firstKey;
        if (this._hasDelimiter()) {
            const delimiterType = this._getDelimiterType();
            const delimiter = this._getDelimiter();
            if (delimiterType === CONSTANT.COUNT_MATCH) {
                values = this._splitByCount(value, delimiter);
            } else {
                values = value.split(delimiter);
            }
            firstKey = values[0];
        } else {
            values = value.split('');
            firstKey = values[0];
        }

        // Added first char of all words added to trie
        this.first_char_of_all_words.push(firstKey);

        if (this._getFirstLevelMap()[firstKey]) {
            const firstNode = this.first_level_map[firstKey];
            return this._addValueToNode(firstNode, values.splice(1));
        } else {
            const newNode = new Node(firstKey);
            this.first_level_map[newNode.getKey()] = newNode;
            return this._addValueToNode(newNode, values.splice(1));
        }
    }

    _getText(prefix, key) {
        let delimiter = this._getDelimiter();
        key = key || '';
        if (delimiter) {
            if (this._getDelimiterType() === CONSTANT.COUNT_MATCH) {
                /**
                 * ignoring in case of count delimeter
                 */
                delimiter = '';
            }
        } else {
            delimiter = '';
        }
        return _.trim(prefix + delimiter + key);
    }

    _getAllNextValues(result, node, prefix) {
        if (node.isLeaf()) {
            return result;
        }
        const keys = _.keys(node.getMap());
        _.each(keys, key => {
            if (node.getNode(key).getWordMark()) {
                result.push(this._getText(prefix, key));
            }
            result = _.union(result, this._getAllNextValues(result, node.getNode(key), this._getText(prefix, key)));
        });
        return result;
    }


    _getNearMatch(result, node, values, prefix) {
        if (_.isEmpty(values)) {
            if (node.getWordMark()) {
                result.push(this._getText(prefix));
            }
            return this._getAllNextValues(result, node, prefix);
        }
        const key = values[0];
        const nextNode = node.getNode(key);
        if (nextNode.isLeaf()) {
            result.push(this._getText(prefix, key));
            return result;
        } else {
            return this._getNearMatch(result, nextNode, values.splice(1), this._getText(prefix, key));
        }
    }

    _removeValue(node, values) {
        // console.log(JSON.stringify(node), values);
        /* istanbul ignore else */
        if (_.isEmpty(values)) {
            /* istanbul ignore else */
            if (node.getWordMark()) {
                /* istanbul ignore else */
                if (node.getDependency() === 1) {
                    node.unMarkWord();
                }
                return node.decreaseDependency();
            }
        }
        const nextKey = values[0];
        /* istanbul ignore else */
        if (node.getNode(nextKey)) {
            return this._removeValue(node.getNode(nextKey), values.splice(1));
        }
    }



    nearMatch(value) {
        if (_.isEmpty(value)) {
            return [];
        }
        let values = [];
        let firstKey;
        if (this._hasDelimiter()) {
            const delimiterType = this._getDelimiterType();
            const delimiter = this._getDelimiter();
            if (delimiterType === CONSTANT.COUNT_MATCH) {
                values = this._splitByCount(value, delimiter);
            } else {
                values = value.split(delimiter);
            }
            firstKey = values[0];
        } else {
            values = value.split('');
            firstKey = values[0];
        }
        if (this._getFirstLevelMap()[firstKey]) {
            const result = this._getNearMatch([], this._getFirstLevelMap()[firstKey], values.splice(1), firstKey);
            return result.sort(this._lexi);
        } else {
            return [];
        }
    }

    /**
     *  expects array of strings to be searched in trie
     *  returns the result in order of entry of strings, Unique values.
     * @param values
     * @return {Array}
     */

    nearMatchAll(values) {
        if (_.isEmpty(values)) {
            return [];
        }
        let result = [];
        _.each(values, value => {
            result = result.concat(this.nearMatch(value));
        });
        return _.uniq(result);
    }

    /**
     * expects array of strings to be added to trie
     * @param elements
     */
    addAll(elements) {
        if (_.isEmpty(elements)) {
            return;
        }
        _.each(elements, ele => {
            this.add(ele);
        });
    }

    /**
     * removes a particular string
     * @param value
     * @return {*}
     */

    remove(value) {
        if (_.isEmpty(value)) {
            return;
        }
        value = _.toLower(value);
        let values = [];
        let firstKey;
        if (this._hasDelimiter()) {
            const delimiterType = this._getDelimiterType();
            const delimiter = this._getDelimiter();
            if (delimiterType === CONSTANT.COUNT_MATCH) {
                values = this._splitByCount(value, delimiter);

            } else {
                values = value.split(delimiter);
            }
            firstKey = values[0];
        } else {
            values = value.split('');
            firstKey = values[0];
        }
        /* istanbul ignore else */
        if (this._getFirstLevelMap()[firstKey]) {
            const firstNode = this.first_level_map[firstKey];
            return this._removeValue(firstNode, values.splice(1));
        }
        return;
    }

    /**
     *
     * @param values
     */
    removeAll(values) {
        if (_.isEmpty(values)) {
            return;
        }
        _.each(values, value => {
            this.remove(value);
        });
    }

    /** ***************************************************************
     * utilities
     *****************************************************************/

    _splitByCount(str, count) {
        if (_.isEmpty(str) || !count || count <= 0) {
            return [];
        }
        const res = [];
        let start = 0;
        while (start < str.length) {
            const temp = str.substr(start, count);
            res.push(temp);
            start += count;
        }
        return res;
    }

    _lexi(curr, next) {
        return curr.toString().localeCompare(next);
    }

}

module
    .exports = Trie;