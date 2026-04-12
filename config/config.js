const httpControl = {
  host: '127.0.0.1', 
  port: 3001
}

const serverMessages = {
  controlMessages: {
    knockDisabled: ' moonos1Redflag !тик команда вимкнена',
    knockEnabled: ' moonos1Greenflag !тик команда увімкнена',
    starfallDisabled: ' moonos1Redflag Зорепад вимкнено',
    starfallEnabled: ' moonos1Greenflag Зорепад увімкнено',
    bothGamesEnabled: ' moonos1Greenflag Всі ігри увімкнено!',
    bothGamesDisabled: ' moonos1Redflag Всі ігри вимкнено!',
    knockStatus: '📊 Статус !тик: {status}',
    starfallStatus: '📊 Статус зорепаду: {status}',
    mehDisabled: ' moonos1Redflag !бля команда вимкнена',
    mehEnabled: ' moonos1Greenflag !бля команда увімкнена',
    mehStatus: '📊 Статус !бля: {status}',
    overallStatus: '📊 Загальний статус: !тик - {knockStatus}, Зорепад - {starfallStatus}, !бля - {retypeWordStatus}',
    healthCheck: 'moonos1Greenflag Система працює нормально'
  },
  statusTexts: {
    enabled: 'увімкнено',
    disabled: 'вимкнено'
  }

}

export { httpControl, serverMessages };
export default { httpControl, serverMessages };
