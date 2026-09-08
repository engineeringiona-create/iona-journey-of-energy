export const processSteps = [
  { node: 'feed_pool', flow: 'feed', title: 'Besleme', body: 'Organik atık besleme havuzunda hazırlanır. Pompalama hattı, hazırlanan karışımı kontrollü biçimde çürütücüye taşır.', output: 'Hazırlanmış substrat' },
  { node: 'digester', flow: 'feed', title: 'Anaerobik çürütme', body: 'Oksijensiz ortamda mikroorganizmalar organik maddeyi parçalar. Karıştırma ve ısıtma, reaktör içindeki koşulların dengeli kalmasını sağlar.', output: 'Biyogaz ve sindirilmiş materyal' },
  { node: 'digester', flow: 'gas', title: 'Gaz toplama', body: 'Üretilen biyogaz reaktörün gaz hacminde toplanır. Gaz hattı, biyogazı projedeki arıtma ve enerji kullanım ekipmanlarına iletir.', output: 'Enerji kullanımına yönlendirilen biyogaz' },
  { node: 'engine_room', flow: 'power', title: 'Elektrik ve ısı', body: 'Kojenerasyon ünitesi biyogazı elektrik ve kullanılabilir ısıya dönüştürür. Geri kazanılan ısı, tesisin proses ihtiyaçlarında değerlendirilebilir.', output: 'Elektrik ve geri kazanılan ısı' }
];
