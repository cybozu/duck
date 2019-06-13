import xmlbuilder from 'xmlbuilder';
import {CompileErrorCase, ErrorReason} from '../report';

export function formatXUnitReport({entryConfigPath, command, items}: ErrorReason): string {
  const testsuites = xmlbuilder.create('testsuites');
  const testsuite = testsuites.element('testsuite').attribute('name', entryConfigPath);
  const errors = items.filter(item => item.level === 'error') as CompileErrorCase[];
  if (errors.length > 0) {
    errors.forEach(error => {
      const testcase = testsuite
        .element('testcase')
        .attribute('classname', error.source)
        .attribute('name', error.key);
      const failure = testcase.element('failure').attribute('message', error.description);
      if (error.context) {
        failure.cdata(error.context);
      }
    });
    return testsuites.end();
  } else {
    return testsuites.end();
  }
}
