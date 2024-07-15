ERROR_EMAIL = 'ratanjagan@gmail.com'
// this defines 6 conditions (a 2x3 design)
// make sure to update num_conds in config.txt to reflect any changes you make here
const PARAMS = conditionParameters(CONDITION, {
  run: [true, false]
})

updateExisting(PARAMS, urlParams) // allow hardcoding e.g. &showSecretStage=true
psiturk.recordUnstructuredData('params', PARAMS);


async function runExperiment() {
  console.log(CONDITION, PARAMS)
  annotation_tasks = await $.getJSON(`static/02-annotation_tasks.json`)
  annotation_task_index = Math.floor(Math.random() * 5)
  annotation_task = annotation_tasks[annotation_task_index]
  // logEvent is how you save data to the database
  logEvent('experiment.initialize', annotation_task)
  // enforceScreenSize(1200, 750)

  async function instructions() {
    await new ExampleInstructions().run(DISPLAY)
  }

  function result_prompt(need, query, result) {
    return `
      <font color="red">_„Informationsbedürfnis“_ </font>: ${need}
      <br/>
      <font color="green">_„Abfrage“_</font>: ${query}
      <br/>
      <font color="blue">„Ergebnis“</font>: <a href="${result}" target="_blank">${result}</a>
      <br/>
      
      -----

      **Relevanz**:
    `
  }

  function relevance_radio_buttons() { return new RadioButtons({
    choices: [
    '1 - Ich weiß nicht genug, um dieses Urteil zu fällen',
    '2 - Nicht genug Zeit, um eine Entscheidung zu treffen',
    '3 - Spam',
    '4 - Nicht so relevant für den Lehrer',
    '5 - Könnte für den Lehrer relevant sein',
    '6 - Genau das, was der Lehrer braucht' ],
    name: 'relevance'
  }) }


  function summary_prompt(need, query, summary) {
    return `
      <font color="red">_„Informationsbedürfnis“_ </font>: ${need}
      <br/>
      <font color="green">_„Abfrage“_</font>: ${query}
      <br/>
      <font color="GoldenRod">_„Zusammenfassung“_</font>: 
      <br/>

${summary}      
      -----

      **Relevanz**:
    `
  }

  async function main() {
    DISPLAY.empty()
    let top = new TopBar({
      nTrial: annotation_task.length,
      height: 70,
      width: 900,
      help: `
        Bewerten Sie die **Relevanz** dieses <font color="GoldenRod">_„Zusammenfassung“_</font>/<font color="blue">„Ergebnis“</font> 
        to this <font color="red">_„Informationsbedürfnis“_ </font> and <font color="green">_„Abfrage“_</font>.
      `
    }).prependTo(DISPLAY)

    let workspace = $('<div>').appendTo(DISPLAY)

    for (let task of annotation_task) {
      console.log(task)
      workspace.empty()
      if (task['type'] == 'summary') {
        const md = markdown(summary_prompt(task.need, task.query, task.content))
        workspace.html(md)
        let radio = relevance_radio_buttons().appendTo(workspace)
        await radio.promise()
      } else {
        workspace.html(markdown(result_prompt(task.need, task.query, task.url)))
        let radio = relevance_radio_buttons().appendTo(workspace)
        await radio.promise()
      }
      top.incrementCounter()
      saveData()
    }
  }

  async function debrief() {
    DISPLAY.empty()
    let div = $('<div>').appendTo(DISPLAY).addClass('text')
    $('<p>').appendTo(div).html(markdown(`
      # Fertig!

      Vielen Dank für Ihre Teilnahme! Bevor Sie gehen, haben wir noch ein paar kurze Fragen.
    `))

    let difficulty = radio_buttons(div, `
      Wie schwierig war das Experiment?
    `, ['zu einfach', 'nicht schwer', 'nicht schwer'])

    let understandability = radio_buttons(div, `
      Wussten Sie genug über das Thema, um vernünftige Entscheidungen zu treffen?
    `, ['ja', 'nein'])

    let feedback = text_box(div, `
      Haben Sie sonstiges Feedback? (optional)
    `)

    makeGlobal({difficulty, understandability})

    await button(div, 'submit').clicked
    // this information is already in the log, but let's put it in one place
    logEvent('debrief.submitted', getInputValues({difficulty, understandability, feedback}))
  }

  // using runTimeline is optional, but it allows you to jump to different blocks
  // with url parameters, e.g. http://localhost:8000/?block=main
  await runTimeline(
    instructions,
    main,
    debrief
  )
};
