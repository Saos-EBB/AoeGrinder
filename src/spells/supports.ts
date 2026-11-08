// Supports wirken auf alle Spells mit einem der Tags, je Support 1× pro Run. Wirkung in core.ts und formulas.ts.
import { t } from '../i18n';

export const SUPPORTS = [
  { id: 'echo', name: t('support.echo.name'), tags: ['Fläche', 'Nova'], desc: t('support.echo.desc') },
  { id: 'bigEcho', name: t('support.bigEcho.name'), tags: ['Fläche', 'Nova'], desc: t('support.bigEcho.desc') },
  { id: 'focus', name: t('support.focus.name'), tags: ['Fläche'], desc: t('support.focus.desc') },
  { id: 'wide', name: t('support.wide.name'), tags: ['Fläche'], desc: t('support.wide.desc') },
  { id: 'potency', name: t('support.potency.name'), tags: ['Kanal'], desc: t('support.potency.desc') },
  { id: 'chain', name: t('support.chain.name'), tags: ['Geschoss'], desc: t('support.chain.desc') },
  { id: 'boneChill', name: t('support.boneChill.name'), tags: ['Frost'], desc: t('support.boneChill.desc') },
  { id: 'blood', name: t('support.blood.name'), tags: ['Dunkel', 'Feuer'], desc: t('support.blood.desc') },
];
