# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.33.2](https://github.com/cybozu/duck/compare/v0.33.1...v0.33.2) (2021-07-20)


### Bug Fixes

* downgrade faastjs to v3 ([#626](https://github.com/cybozu/duck/issues/626)) ([2b2b0e8](https://github.com/cybozu/duck/commit/2b2b0e864b04639b14a56552f1cc87e4a75f049f))

### [0.33.1](https://github.com/cybozu/duck/compare/v0.33.0...v0.33.1) (2021-07-20)


### Bug Fixes

* **deps:** update dependency @types/pino to ^6.3.8 ([#605](https://github.com/cybozu/duck/issues/605)) ([f3045dc](https://github.com/cybozu/duck/commit/f3045dcd5fe8ccbf94f72c6f059dc36c2dbdfd5b))
* **deps:** update dependency faastjs to ^5.0.9 ([#606](https://github.com/cybozu/duck/issues/606)) ([54d2451](https://github.com/cybozu/duck/commit/54d245147a34c367da911d217c44e9b17a5c4e03))
* **deps:** update dependency faastjs to ^5.4.5 ([#614](https://github.com/cybozu/duck/issues/614)) ([531df15](https://github.com/cybozu/duck/commit/531df151b224bdaab6dee3e6681765e23a16e9ef))
* **deps:** update dependency fastify to ^2.15.3 ([#607](https://github.com/cybozu/duck/issues/607)) ([7514b3d](https://github.com/cybozu/duck/commit/7514b3dfe522ea645b313463d8885a9b7f907d85))
* **deps:** update dependency glob to ^7.1.7 ([#608](https://github.com/cybozu/duck/issues/608)) ([cba2126](https://github.com/cybozu/duck/commit/cba21262311b4559917c2fce3f691ff5f7dd020b))
* **deps:** update dependency rxjs to ^6.6.7 ([#609](https://github.com/cybozu/duck/issues/609)) ([561ed6f](https://github.com/cybozu/duck/commit/561ed6fa0d2d30cfd79e76402170b5e60aec0a24))
* **deps:** update dependency semver to ^7.3.5 ([#610](https://github.com/cybozu/duck/issues/610)) ([661548c](https://github.com/cybozu/duck/commit/661548c22760c7714e396746c1eeefcd941f2c6b))
* **deps:** update dependency tempy to ^1.0.1 ([#611](https://github.com/cybozu/duck/issues/611)) ([c5bac79](https://github.com/cybozu/duck/commit/c5bac793b3706c576b9ae811e3d19554da54c06a))

## [0.33.0](https://github.com/cybozu/duck/compare/v0.32.8...v0.33.0) (2021-05-21)


### ⚠ BREAKING CHANGES

* drop Node v10 support because of EOL

### Bug Fixes

* make directories recursively to generate deps.js ([#590](https://github.com/cybozu/duck/issues/590)) ([bfe1e40](https://github.com/cybozu/duck/commit/bfe1e40e1d041223b5df420aff9926422da59ca3))
* Show friendly message for missing entryConfigDir ([#598](https://github.com/cybozu/duck/issues/598)) ([5ca2f33](https://github.com/cybozu/duck/commit/5ca2f33f56d480b1d7874a087d6462fa805831f5))
* **deps:** update dependency @types/pino to ^6.3.5 ([#560](https://github.com/cybozu/duck/issues/560)) ([3d029f1](https://github.com/cybozu/duck/commit/3d029f1857c76e19456dd7266d94a3696feff83c))
* **deps:** update dependency execa to v5 ([#550](https://github.com/cybozu/duck/issues/550)) ([27039e9](https://github.com/cybozu/duck/commit/27039e9127da320b127a7f8c5c7c819e0ea8cb92))
* **deps:** update dependency fastify to v2.15.1 [security] ([#572](https://github.com/cybozu/duck/issues/572)) ([03df523](https://github.com/cybozu/duck/commit/03df5231f32fe5bc4daa9137c2f1d811069c1471))
* **deps:** update dependency google-closure-deps to v20201102 ([#536](https://github.com/cybozu/duck/issues/536)) ([a4f9873](https://github.com/cybozu/duck/commit/a4f9873df4e1e8723b7647ac89485c478118bc26))
* **deps:** update dependency merge-options to ^3.0.4 ([#541](https://github.com/cybozu/duck/issues/541)) ([1613697](https://github.com/cybozu/duck/commit/1613697f3e05992122a9267fced812db8e430beb))
* **deps:** update dependency semver to ^7.3.4 ([#548](https://github.com/cybozu/duck/issues/548)) ([70e1fb1](https://github.com/cybozu/duck/commit/70e1fb1c883c9bff5e961bcb4e6581ab2823e58d))
* **deps:** update dependency yargs to ^16.2.0 ([#552](https://github.com/cybozu/duck/issues/552)) ([252a8b1](https://github.com/cybozu/duck/commit/252a8b16e71ff310fdb6047152b7be38efad3037))


* drop Node v10 support  ([#601](https://github.com/cybozu/duck/issues/601)) ([830e096](https://github.com/cybozu/duck/commit/830e0969523d943c86d87d476a16ec2f2c34bbde))

### [0.32.8](https://github.com/cybozu/duck/compare/v0.32.7...v0.32.8) (2020-11-24)


### Features

* add soyClasspaths option ([6a6d656](https://github.com/cybozu/duck/commit/6a6d656493f0634dc978039a4606e65335f276f9))


### Bug Fixes

* **deps:** update dependency @types/pino to ^6.3.4 ([#537](https://github.com/cybozu/duck/issues/537)) ([7cf90bf](https://github.com/cybozu/duck/commit/7cf90bf4d09aacfb7abd6b93bc81125006ffeee9))
* **deps:** update dependency array.prototype.flat to ^1.2.4 ([#535](https://github.com/cybozu/duck/issues/535)) ([304e7c7](https://github.com/cybozu/duck/commit/304e7c72b5582f6ea895e0c4e359dad120be180f))
* **deps:** update dependency chokidar to ^3.4.3 ([#503](https://github.com/cybozu/duck/issues/503)) ([3ed0db2](https://github.com/cybozu/duck/commit/3ed0db29f53690736da9eb06e1fddd4df4d4b8f6))
* **deps:** update dependency execa to ^4.0.3 ([#476](https://github.com/cybozu/duck/issues/476)) ([280e17b](https://github.com/cybozu/duck/commit/280e17b0e02d293c62af836f3319e1d1721a46c4))
* **deps:** update dependency execa to ^4.1.0 ([#512](https://github.com/cybozu/duck/issues/512)) ([8128707](https://github.com/cybozu/duck/commit/812870770ed6a7940ea5b5e51bd83307bdec3de9))
* **deps:** update dependency fastify to v2.15.1 [security] ([#506](https://github.com/cybozu/duck/issues/506)) ([13f00dd](https://github.com/cybozu/duck/commit/13f00dd26e3ca4cee1d9a8c8903fcd783d2226f6))
* **deps:** update dependency merge-options to v3 ([#528](https://github.com/cybozu/duck/issues/528)) ([8908d95](https://github.com/cybozu/duck/commit/8908d9581440710670bb2d0a0843375363e2e5ed))
* **deps:** update dependency p-limit to v3 ([14f170d](https://github.com/cybozu/duck/commit/14f170d3c29ae2be9ed1587ac76dc69bd98bd7e8))
* **deps:** update dependency p-limit to v3 ([3b0ae32](https://github.com/cybozu/duck/commit/3b0ae32e43800faad4598234f765b12a2bddbdff))
* **deps:** update dependency p-settle to ^4.1.1 ([#466](https://github.com/cybozu/duck/issues/466)) ([eb13f7f](https://github.com/cybozu/duck/commit/eb13f7f12ab28f4c2e75a525c928c774af5470bd))
* **deps:** update dependency pino to ^6.7.0 ([#513](https://github.com/cybozu/duck/issues/513)) ([ab5fcb6](https://github.com/cybozu/duck/commit/ab5fcb64228f7153ec2f881f4c36e9c46e44d44c))
* **deps:** update dependency pino to v6 ([#427](https://github.com/cybozu/duck/issues/427)) ([62ac7c3](https://github.com/cybozu/duck/commit/62ac7c36b2be472ee28d3a57f95686e08f2b5382))
* **deps:** update dependency pino-pretty to v4 ([#432](https://github.com/cybozu/duck/issues/432)) ([33ba0c0](https://github.com/cybozu/duck/commit/33ba0c0778936f84b6238e7e14aee67f5e6742ff))
* **deps:** update dependency rxjs to ^6.6.3 ([#479](https://github.com/cybozu/duck/issues/479)) ([d115b7b](https://github.com/cybozu/duck/commit/d115b7b5be2a460a2c9fe869c98600065e7795d9))
* **deps:** update dependency split2 to ^3.2.2 ([#514](https://github.com/cybozu/duck/issues/514)) ([5af391d](https://github.com/cybozu/duck/commit/5af391d3ffaa5ea364b2f35c4ddb8996fa84fb6f))
* **deps:** update dependency strip-json-comments to ^3.1.1 ([#505](https://github.com/cybozu/duck/issues/505)) ([234fc92](https://github.com/cybozu/duck/commit/234fc927ad8bd13a6a0db6112d795b8c25f780a4))
* **deps:** update dependency tempy to ^0.7.1 ([#515](https://github.com/cybozu/duck/issues/515)) ([83dbf39](https://github.com/cybozu/duck/commit/83dbf39ef7c2cd192e881d019c9e7cc717bbf4aa))
* **deps:** update dependency tempy to v1 ([#529](https://github.com/cybozu/duck/issues/529)) ([83e329d](https://github.com/cybozu/duck/commit/83e329d819c913fbd176c62cc5945eb11c8463db))
* **deps:** update dependency xmlbuilder to v15 ([dc4a044](https://github.com/cybozu/duck/commit/dc4a044f51548e4866fc2b9221c04a76686784f8))
* **deps:** update dependency yargs to ^15.4.1 ([#516](https://github.com/cybozu/duck/issues/516)) ([7edc755](https://github.com/cybozu/duck/commit/7edc755354ebed54f04b8b24282f2291725b2e3f))
* **deps:** update dependency yargs to ^16.1.1 ([#531](https://github.com/cybozu/duck/issues/531)) ([d189848](https://github.com/cybozu/duck/commit/d189848c3b706b14487aac35c2cf20086f34e6d5))
* **deps:** update dependency yargs to v16 ([#530](https://github.com/cybozu/duck/issues/530)) ([b5d3ba2](https://github.com/cybozu/duck/commit/b5d3ba2b8c9608c0520c1ba4121f99e05527ac70))

### [0.32.7](https://github.com/cybozu/duck/compare/v0.32.6...v0.32.7) (2020-06-04)


### Bug Fixes

* **deps:** update dependency chokidar to ^3.4.0 ([0ed308a](https://github.com/cybozu/duck/commit/0ed308a09e179c3d5676727799fccd5fa584fb3d))
* **deps:** update dependency fastify to ^2.14.1 ([e31fcaf](https://github.com/cybozu/duck/commit/e31fcaff27070120e2f29e8b2685462f2c6ca660))
* **deps:** update dependency google-closure-deps to v20200517 ([11074e6](https://github.com/cybozu/duck/commit/11074e640ce9e1b837e43cef8939fc4dec5f4d0d))
* **deps:** update dependency google-closure-deps to v20200517 ([e88c3cb](https://github.com/cybozu/duck/commit/e88c3cb9b99b890016a68c0b9b1d0bcf8c73d923))
* **deps:** update dependency semver to ^7.3.2 ([21b57b3](https://github.com/cybozu/duck/commit/21b57b31d6dc3d4e7074df51d15a8d45b57c71ed))

### [0.32.6](https://github.com/cybozu/duck/compare/v0.32.5...v0.32.6) (2020-04-28)


### Bug Fixes

* **deps:** update dependency fastify to ^2.13.1 ([#440](https://github.com/cybozu/duck/issues/440)) ([31e611e](https://github.com/cybozu/duck/commit/31e611e2936c3d6be70834e8cfd4680f9bdaab03))
* **deps:** update dependency p-limit to ^2.3.0 ([6c75a5e](https://github.com/cybozu/duck/commit/6c75a5ef7953bd825a7c453e687a240f2741938d))
* **deps:** update dependency rxjs to ^6.5.5 ([#434](https://github.com/cybozu/duck/issues/434)) ([841b4ec](https://github.com/cybozu/duck/commit/841b4ecb3b886be73257152031bf1cad195ccfd7))
* **serve:** http2 does not work ([#438](https://github.com/cybozu/duck/issues/438)) ([222055f](https://github.com/cybozu/duck/commit/222055ff31f3739b16aad8bc55e0c9728a30862a))

### [0.32.5](https://github.com/cybozu/duck/compare/v0.32.4...v0.32.5) (2020-03-25)


### Bug Fixes

* **deps:** update dependency fastify to ^2.12.1 ([#388](https://github.com/cybozu/duck/issues/388)) ([629d037](https://github.com/cybozu/duck/commit/629d0376f6e15c88a3e4885c7f878849ec3e4a30))
* fail to output json with batch option 'aws' ([#378](https://github.com/cybozu/duck/issues/378)) ([c10bb05](https://github.com/cybozu/duck/commit/c10bb05d663a79bd78b2ac90971c9bffe7f82d4f))
* update minimum Node version to 10.17 ([#362](https://github.com/cybozu/duck/issues/362)) ([e2cff49](https://github.com/cybozu/duck/commit/e2cff4944041ba6799a0847cb67dd870322d7149)), closes [#409](https://github.com/cybozu/duck/issues/409)
* **deps:** update dependency fastify to ^2.13.0 ([#420](https://github.com/cybozu/duck/issues/420)) ([15dde9f](https://github.com/cybozu/duck/commit/15dde9fb4057ae64e2cdb20d4d9c477b43ff39f9))
* **deps:** update dependency pino to ^5.17.0 ([#412](https://github.com/cybozu/duck/issues/412)) ([629c1df](https://github.com/cybozu/duck/commit/629c1df3d401035eaa1f9b739120a0bbfbfabc61))
* **deps:** update dependency pino-pretty to ^3.6.1 ([#401](https://github.com/cybozu/duck/issues/401)) ([66ac0e7](https://github.com/cybozu/duck/commit/66ac0e71915f1e15569f46c82b95c26ac59801bb))
* **deps:** update dependency tempy to ^0.5.0 ([371a14b](https://github.com/cybozu/duck/commit/371a14b8067b0e1bf6ef1db1ec7cefa7434d14ec))
* **deps:** update dependency yargs to ^15.3.1 ([#416](https://github.com/cybozu/duck/issues/416)) ([590df2a](https://github.com/cybozu/duck/commit/590df2a17c9adabf82922b6023ab4b858c5832f7))

### [0.32.4](https://github.com/cybozu/duck/compare/v0.32.3...v0.32.4) (2020-02-25)


### Bug Fixes

* **deps:** update dependency semver to ^7.1.3 ([#398](https://github.com/cybozu/duck/issues/398)) ([ddd06fe](https://github.com/cybozu/duck/commit/ddd06fee8817e7c9a953e2b93ec33ce2954ef458))

### [0.32.3](https://github.com/cybozu/duck/compare/v0.32.2...v0.32.3) (2020-02-10)


### Bug Fixes

* **deps:** update dependency @types/pino to ^5.15.5 ([#387](https://github.com/cybozu/duck/issues/387)) ([75924b4](https://github.com/cybozu/duck/commit/75924b416c8ef4ab864a1169e3b856ae1af64355))
* eslintrc in examples ([6aa2fc3](https://github.com/cybozu/duck/commit/6aa2fc3e7376def180445e1925dbdc8bed1c5cb5))
