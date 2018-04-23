// ==UserScript==
// @name         Jira Utils
// @namespace    https://github.com/TheBit/user-script-copy-jira-info-for-git
// @version      2.0.0
// @description  Helpful jira functionality
// @author       TheBit, D4ST1N
// @license MIT
// @require      https://cdnjs.cloudflare.com/ajax/libs/clipboard.js/1.7.1/clipboard.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/vue/2.5.16/vue.js
// @require      https://unpkg.com/axios/dist/axios.min.js
// @match        https://jira.betlab.com/browse/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  Vue.component(
    'juactions',
    {
      template: `
          <div class="juactions-root">
            <div class="buttons-group">
              Branch: 
              <div
                v-for="issueType in issueTypes"
                :key="issueType.key"
                :class="{'action-button': true, 'action-button--selected': issueType.selected}"
                @click="selectType(issueTypes, issueType)"
              >
                {{ issueType.label }}
              </div>
            </div>
            <div class="group-separator"></div>
            <div class="buttons-group">
              From: 
              <div
                v-for="platform in platforms"
                :key="platform.key"
                :class="{'action-button': true, 'action-button--selected': platform.selected}"
                @click="selectType(platforms, platform)"
              >
                {{ platform.label }}
              </div>
            </div>
            <div class="buttons-group">
              <div
                v-for="branch in branches"
                :key="branch.key"
                :class="{'action-button': true, 'action-button--selected': branch.selected}"
                @click="selectType(branches, branch, false)"
              >
                {{ branch.label }}
              </div>
            </div>
            <div class="group-separator" v-if="showBranchName"></div>
            <div class="branch-name-block" v-show="showBranchName">
              To: 
              <input type="text" disabled class="branch-name__constant-part" :value="constantPart">
              <input type="text" class="branch-name__editable-part" v-model="editablePart" ref="editablePart" @input="formatBranchName">
              <div class="group-separator"></div>
              <div class="action-button copyButton" :data-clipboard-text="newBranchName">
                <span class="action-button__title">Copy</span>
                <span class="aui-icon aui-icon-small aui-iconfont-copy-clipboard action-button__icon"></span>
              </div>
              <div :class="{'action-button': true, 'action-button--view': branchExists, 'action-button--fork': !branchExists }" @click="createBranch">
                <span class="action-button__title">{{ branchExists ? 'View' : 'Fork' }}</span>
                <span
                  :class="{
                    'aui-icon': true,
                    'aui-icon-small': true,
                    'aui-iconfont-devtools-branch': !branchExists,
                    'aui-iconfont-view': branchExists,
                    'action-button__icon': true
                  }">
                </span>
              </div>
            </div>
            <div class="group-separator"></div>
            <div class="buttons-group">
              <div class="action-button copyButton" :data-clipboard-text="commitMessage">
                <span class="action-button__title">Commit message</span>
                <span class="aui-icon aui-icon-small aui-iconfont-devtools-commit action-button__icon"></span>
              </div>
            </div>
          </div>`,
      data() {
        return {
          styles: document.createElement('style'),
          baseStyles: `
          #juapp {
              display: flex;
              width: 100%;
          }
          .juactions-root {
              display: flex;
              width: 100%;
              padding: 5px 10px;
              background: #CFD8DC;
              align-items: center;
          }
          .buttons-group {
              margin-right: 10px;
              max-width: 30%;
              display: flex;
              flex-wrap: wrap;
              align-items: center;
          }
          .action-button {
              display: inline-flex;
              justify-content: center;
              align-items: center;
              font-size: 14px;
              background-color: #f5f5f5;
              color: #333;
              padding: 3px 10px;
              border: 1px solid #ccc;
              border-radius: 5px;
              cursor: pointer;
              transition: all .375s;
          }
          .action-button--selected {
              background-color: #4CAF50;
              color: #fff;
          }
          .action-button--view {
              background-color: #90A4AE;
              color: #fff;
          }
          .action-button--fork {
              background-color: #FFB74D;
              color: #fff;
          }
          .action-button:hover {
              margin-left: 0;
          }
          .action-button__icon {
              pointer-events: none;
          }
          .action-button--view .action-button__icon,
          .action-button--fork .action-button__icon {
              color: #fff;
          }
          .action-button__icon:not(:first-child) {
              margin-left: 5px;
          }
          .action-button__title {
              pointer-events: none;
          }
          .branch-name-block {
              display: flex;
              align-items: center;
          }
          .branch-name__constant-part {
              height: 28px;
              box-sizing: border-box;
              padding: 3px 0 3px 8px;
              background-color: #fff;
              border: 1px solid #ccc;
              color: #666;
              opacity: .8;
              margin-left: 5px;
              width: 150px;
              text-align: right;
          }
          .branch-name__editable-part {
              height: 28px;
              box-sizing: border-box;
              padding: 3px 8px 3px 0;
          }
          .group-separator {
              height: 80%;
              width: 1px;
              background-color: #d3d3d3;
              border-right: 1px solid #aaa;
              margin-left: 5px;
              margin-right: 15px;
          }`,
          issueTypes: [
            {
              label: 'Feature',
              key: 'feature',
              selected: false,
              filter: 'master',
            },
            {
              label: 'Bugfix',
              key: 'bugfix',
              selected: false,
              filter: 'master',
            },
            {
              label: 'Hotfix',
              key: 'hotfix',
              selected: false,
              filter: 'release',
            },
          ],
          platforms: [
            {
              label: 'air-pm',
              key: 'air/air-pm',
              selected: false,
            },
            {
              label: 'air-mobile',
              key: 'air/air-mobile',
              selected: false,
            },
          ],
          branches: [],
          selectedBranchKey: '',
          initialBranchLabel: '',
          desktop: 'air/air-pm',
          mobile: 'air/air-mobile',
          showBranchName: false,
          constantPart: '',
          editablePart: '',
          clipboard: undefined,
          branchExists: false,
          existedBranch: undefined,
          commitMessage: '',
        };
      },
      mounted() {
        this.createStyles();
        this.setCommitMessage();
        this.setInitialValues();
        this.clipboard = new Clipboard('.copyButton');
      },
      watch: {
        showBranchName() {
          this.editablePart = this.getEditablePart();
          this.$nextTick(() => {
            this.fixEditablePartWidth();
          });
        },
      },
      computed: {
        newBranchName() {
          return `${this.constantPart}${this.editablePart}`;
        }
      },
      methods:  {
        createStyles() {
          document.body.appendChild(this.styles);
          this.styles.innerHTML = this.baseStyles;
        },
        setInitialValues() {
          const initialPlatform = this.getInitialPlatform();
          const initialIssueType = this.getInitialIssueType();
          this.initialBranchLabel = this.getInitialBrand();
          this.issueTypes.filter(issueType => issueType.key === initialIssueType)[0].selected = true;
          this.selectType(this.platforms, this.platforms.filter(platform => platform.label === initialPlatform)[0]);
        },
        fixEditablePartWidth() {
          const temp = document.createElement('div');
          temp.innerHTML = this.$refs.editablePart.value;
          document.body.appendChild(temp);
          temp.style.display = 'inline-block';
          document.body.appendChild(temp);
          this.$refs.editablePart.style.width = `${temp.offsetWidth + 10}px`;
          document.body.removeChild(temp);
        },
        formatBranchName() {
          this.editablePart = this.formatToValidBranchName(this.editablePart.replace(/\s/ig, '-'), false);
          this.$nextTick(() => {
            this.fixEditablePartWidth();
          });
        },
        getSelected(array) {
          return array.filter(item => item.selected)[0];
        },
        selectType(types, selectedType, getBranches = true) {
          let previousSelected;
          types.forEach((type) => {
            if (type.selected) {
              previousSelected = type;
            }

            type.selected = false;
          });
          selectedType.selected = true;
          this.setConstantPart();

          if (getBranches && previousSelected !== selectedType) {
            const selectedPlatform = this.getSelected(this.platforms);
            const selectedIssueType = this.getSelected(this.issueTypes);

            if (selectedPlatform && selectedIssueType) {
              this.getBranches(selectedPlatform.key, selectedIssueType.filter);
            }
          }
        },
        setCommitMessage() {
          const ticket = this.getTicketID();
          const ticketName = this.getTicketName();
          const ticketNameFormatted = ticketName.replace(/\s\s/ig, ' ').replace(/\[.*?\]/ig, '').trim();
          this.commitMessage = `[${ticket}] ${ticketNameFormatted}`;
        },
        setConstantPart() {
          const ticket = this.getTicketID();
          const issueType = this.issueTypes.filter(issue => issue.selected)[0];
          const brand = this.branches.filter(branch => branch.selected)[0];

          if (!brand || !issueType) {
            this.showBranchName = false;
            return;
          }

          this.showBranchName = true;
          this.constantPart = `${issueType.key}/${brand.label}/${ticket}-`;
          this.checkBranchExists();
        },
        getTicketName() {
          return document.querySelector('#summary-val').innerText;
        },
        getTicketID() {
          return document.querySelector('#key-val').innerText;
        },
        getEditablePart() {
          const ticketName = this.getTicketName();
          return this.formatToValidBranchName(ticketName);
        },
        formatToValidBranchName(string, limit = 5) {
          let formattedString = string.replace(/["'`]/g, '') /* remove quotes */
                                      .replace(/\s-\s/g, '') /* remove dashes */
                                      .replace(/\s\s/ig, ' ') /* Replace double spaces with single space */
                                      .replace(/\[.*?]/ig, '') /* Strip tags in square brackets e.g.: [tag] */
                                      .trim() /* After removing square brackets - there might be leading white space left, so need to trim */
                                      .replace(/\s/ig, '-') /* Replace all spaces with dashes */
                                      .replace(/^[./]|\.\.|@{|[\/.]$|^@$|[~^:\x00-\x20\x7F\s?*[\]\\]/ig, ''); /* Strip all forbidden chars */
          return limit ? formattedString.split('-').slice(0, limit).join('-') : formattedString;
        },
        getBranches(type, search) {
          const params = [
            {
              key: 'private_token',
              value: '5VK28u4H9d39NFv1r7sv',
            },
            {
              key: 'search',
              value: search,
            },
            {
              key: 'per_page',
              value: 50,
            },
          ];
          axios.get(`https://git.betlab.com/api/v4/projects/${encodeURIComponent(type)}/repository/branches?${this.processParams(params)}`)
               .then((response) => {
                 console.log(response);
                 this.filterBranches(response.data, type, search);
                 this.setConstantPart();
               })
               .catch((error) => {
                 console.log(error);
               });
        },
        checkBranchExists() {
          const selectedPlatform = this.getSelected(this.platforms);
          const params = [
            {
              key: 'private_token',
              value: '5VK28u4H9d39NFv1r7sv',
            },
            {
              key: 'search',
              value: this.constantPart,
            },
          ];
          axios.get(`https://git.betlab.com/api/v4/projects/${encodeURIComponent(selectedPlatform.key)}/repository/branches?${this.processParams(params)}`)
               .then((response) => {
                 console.log(response);
                 this.branchExists = response.data.length > 0;
                 this.existedBranch = response.data[0];
               })
               .catch((error) => {
                 console.log(error);
               });
        },
        filterBranches(branches, type, search) {
          const selectedBranch = this.getSelected(this.branches);

          if (selectedBranch) {
            this.selectedBranchKey = selectedBranch.key;
          }

          if (type === this.desktop && search !== 'release') {
            this.branches = [
              {
                label:    'com',
                key:      'develop',
                value:    'develop',
                selected: this.initialBranchLabel === 'com' || this.selectedBranchKey === 'develop' || false,
              },
            ];
          } else if (type === this.mobile && search !== 'release') {
            this.branches = [
              {
                label:    'com',
                key:      'master',
                value:    'master',
                selected: this.initialBranchLabel === 'com' || this.selectedBranchKey === 'master' || false,
              },
            ];
          } else {
            this.branches = [];
          }

          branches.forEach((branch) => {
            if (search === 'master') {
              const branchNameParts = branch.name.split('-');

              if (branchNameParts.length > 1) {
                this.branches.push(
                  {
                    key:      branch.name,
                    label:    branchNameParts[1],
                    value:    branchNameParts[1],
                    selected: this.initialBranchLabel === branchNameParts[1] || this.selectedBranchKey === branch.name || false,
                  }
                );
              }
            } else if (search === 'release') {
              const branchNameParts = branch.name.split('/');

              if (branchNameParts.length > 1 && branch.name.indexOf(new Date().getFullYear()) !== -1) {
                let branchBrand = this.getBranchBrand(branchNameParts[0]);

                if (branchBrand === 'release' || branchBrand === 'mobile' || branchBrand === 'desktop') {
                  branchBrand = 'com';
                }

                const branchIndex = this.getBranchIndexByBrand(branchBrand);
                const branchObject = {
                  key:      branch.name,
                  label:    branchBrand,
                  value:    branchNameParts[1],
                  selected: this.initialBranchLabel === branchBrand || this.selectedBranchKey === branch.name || false,
                };

                if (branchIndex !== undefined) {
                  const existDate = new Date(this.branches[branchIndex].value);
                  const currentDate = new Date(branchNameParts[1]);

                  if (currentDate > existDate) {
                    this.branches[branchIndex] = branchObject;
                  }
                } else {
                  this.branches.push(branchObject);
                }
              }
            }
          });

          this.initialBranchLabel = undefined;
        },
        getBranchBrand(branch) {
          const branchParts = branch.split('-');
          return branchParts[branchParts.length - 1];
        },
        getBranchIndexByBrand(brand) {
          let branchIndex;
          this.branches.forEach((branch, index) => {
            if (branch.label === brand) {
              branchIndex = index;
            }
          });

          return branchIndex;
        },
        processParams(params) {
          return params.map(param => `${param.key}=${param.value}`).join('&');
        },
        createBranch() {
          const selectedPlatform = this.getSelected(this.platforms);
          if (this.branchExists) {
            const win = window.open(`https://git.betlab.com/${selectedPlatform.key}/tree/${this.existedBranch.name}`, '_blank');
            win.focus();
          } else {
            const selectedBranch = this.getSelected(this.branches);
            const params = [
              {
                key:   'private_token',
                value: '5VK28u4H9d39NFv1r7sv',
              },
              {
                key:   'branch',
                value: this.newBranchName,
              },
              {
                key:   'ref',
                value: selectedBranch.key,
              },
            ];
            axios.post(`https://git.betlab.com/api/v4/projects/${encodeURIComponent(selectedPlatform.key)}/repository/branches?${this.processParams(params)}`)
                 .then((response) => {
                   console.log(response);
                   this.checkBranchExists();
                 })
                 .catch((error) => {
                   console.log(error);
                 });
          }
        },
        getInitialIssueType() {
          const issueType = document.querySelector('#type-val').innerText.toLowerCase().trim();
          const issueTypesMapping = {
            feature: [
              'task',
              'story',
              'tech task'
            ],
            bugfix: [
              'defect'
            ],
            hotfix: [
              'production defect'
            ],
          };
          let initialIssueType;

          Object.entries(issueTypesMapping).forEach(([key, value]) => {
            if (value.includes(issueType)) {
              initialIssueType = key;
            }
          });

          return initialIssueType;
        },
        getInitialPlatform() {
          const ticketName = this.getTicketName();

          if (ticketName.toLowerCase().indexOf('mobile') !== -1) {
            return 'air-mobile';
          }

          return 'air-pm';
        },
        getInitialBrand() {
          const ticketName = this.getTicketName();

          if (ticketName.toLowerCase().indexOf('[cy]') !== -1) {
            return 'cy';
          } else if (ticketName.toLowerCase().indexOf('[ge]') !== -1) {
            return 'ge';
          } else if (ticketName.toLowerCase().indexOf('[ru]') !== -1) {
            return 'ru';
          } else if (ticketName.toLowerCase().indexOf('[mt]') !== -1) {
            return 'mt';
          } else if (ticketName.toLowerCase().indexOf('[tz]') !== -1) {
            return 'tz';
          }

          return 'com';
        }
      },
    }
  );

  const appRoot = document.createElement('div');
  appRoot.id = 'juapp';
  appRoot.innerHTML = '<juactions></juactions>';
  appRoot.classList.add('toolbar-group');
  const appContainer = document.querySelector('.ops-menus.aui-toolbar');
  appContainer.appendChild(appRoot);
  new Vue(
    {
      el: '#juapp',
    }
  );
})();
