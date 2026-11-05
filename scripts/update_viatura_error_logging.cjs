const fs = require('fs');
const path = require('path');

const viaturaPath = path.resolve(__dirname, '../src/pages/Viatura.jsx');
let content = fs.readFileSync(viaturaPath, 'utf8');

// 1. Adicionar import de registrarErroApp se não existir
if (!content.includes('registrarErroApp')) {
  content = content.replace(
    "import { hashPassword } from '../lib/security';",
    "import { hashPassword } from '../lib/security';\nimport { registrarErroApp } from '../lib/errorLogger';"
  );
}

// 2. Atualizar handleLoginMe
const oldLoginMe = `      } else {
        showAlert("Erro", resData.error || "Falha ao realizar login.", "danger");
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      showAlert("Erro", "Falha de conexão com o servidor de login.", "danger");
    } finally {`;

const newLoginMe = `      } else {
        await registrarErroApp({
          origem: 'LOGIN_ME',
          mensagem: \`Falha no login operacional (ME): \${resData.error || 'Credenciais inválidas'}\`,
          detalhes: { matricula: authMatricula, prefixo },
          severidade: 'aviso'
        });
        showAlert("Erro", resData.error || "Falha ao realizar login.", "danger");
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      await registrarErroApp({
        origem: 'LOGIN_ME',
        mensagem: 'Erro de conexão/rede ao autenticar militar operacional (ME)',
        detalhes: { matricula: authMatricula, prefixo },
        erro: err,
        severidade: 'erro'
      });
      showAlert("Erro", "Falha de conexão com o servidor de login.", "danger");
    } finally {`;

content = content.replace(oldLoginMe, newLoginMe);

// 3. Atualizar handleRegisterMe
const oldRegisterMe = `      } else {
        showAlert("Erro", resData.error || "Falha ao realizar cadastro.", "danger");
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      showAlert("Erro", "Falha ao realizar cadastro no servidor.", "danger");
    } finally {`;

const newRegisterMe = `      } else {
        await registrarErroApp({
          origem: 'CADASTRO_ME',
          mensagem: \`Falha no cadastro de militar (ME): \${resData.error || 'Erro desconhecido'}\`,
          detalhes: { matricula: authMatricula, graduacao: authGraduacao, nome: authNome, telefone: authTelefone, prefixo },
          severidade: 'aviso'
        });
        showAlert("Erro", resData.error || "Falha ao realizar cadastro.", "danger");
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      await registrarErroApp({
        origem: 'CADASTRO_ME',
        mensagem: 'Erro de conexão/servidor no cadastro de militar (ME)',
        detalhes: { matricula: authMatricula, graduacao: authGraduacao, nome: authNome },
        erro: err,
        severidade: 'erro'
      });
      showAlert("Erro", "Falha ao realizar cadastro no servidor.", "danger");
    } finally {`;

content = content.replace(oldRegisterMe, newRegisterMe);

// 4. Atualizar handleSubmit (Assunção de VTR)
const oldAssuncaoCatch = `      showAlert("Sucesso!", "Turno iniciado com sucesso. Bom serviço!", "success", () => {
        finalizarSessaoAposOperacao();
      });
    } catch (err) {
      console.error(err);
      showAlert("Erro", "Não foi possível iniciar o serviço.", "danger");
      setSubmitting(false);
    }`;

const newAssuncaoCatch = `      showAlert("Sucesso!", "Turno iniciado com sucesso. Bom serviço!", "success", () => {
        finalizarSessaoAposOperacao();
      });
    } catch (err) {
      console.error(err);
      await registrarErroApp({
        origem: 'ASSUNCAO_VTR',
        mensagem: \`Erro ao assumir a VTR \${prefixo}: \${err.message || 'Falha na gravação do serviço'}\`,
        detalhes: {
          prefixo,
          motorista,
          matricula,
          kmInicial,
          patrulheiro,
          finalidade,
          statusVtrAtual: viatura?.status
        },
        erro: err,
        severidade: 'critico'
      });
      showAlert("Erro", "Não foi possível iniciar o serviço.", "danger");
      setSubmitting(false);
    }`;

content = content.replace(oldAssuncaoCatch, newAssuncaoCatch);

// 5. Atualizar handleFinalizarServico (Validação KM e Catch de encerramento)
const oldFinalizarKm = `      if (Number(kmFinal) < (viatura.km_atual || 0)) {
        showAlert("Erro de KM", "O KM final não pode ser menor que o KM inicial.", "warning");
        setSubmitting(false);
        return;
      }`;

const newFinalizarKm = `      if (Number(kmFinal) < (viatura.km_atual || 0)) {
        await registrarErroApp({
          origem: 'FINALIZACAO_VTR',
          mensagem: \`Tentativa de finalizar VTR \${prefixo} com KM final (\${kmFinal}) menor que KM atual (\${viatura.km_atual})\`,
          detalhes: {
            prefixo,
            kmFinalInformado: Number(kmFinal),
            kmAtualVtr: viatura.km_atual,
            matriculaConfirmacao,
            matriculaAtiva: viatura.matricula_ativa
          },
          severidade: 'aviso'
        });
        showAlert("Erro de KM", "O KM final não pode ser menor que o KM inicial.", "warning");
        setSubmitting(false);
        return;
      }`;

content = content.replace(oldFinalizarKm, newFinalizarKm);

const oldFinalizarCatch = `        } else {
          finalizarSessaoAposOperacao();
        }
      });
    } catch (err) {
      console.error(err);
      showAlert("Erro", "Não foi possível finalizar o serviço.", "danger");
      setSubmitting(false);
    }`;

const newFinalizarCatch = `        } else {
          finalizarSessaoAposOperacao();
        }
      });
    } catch (err) {
      console.error(err);
      await registrarErroApp({
        origem: 'FINALIZACAO_VTR',
        mensagem: \`Erro ao finalizar turno da VTR \${prefixo}: \${err.message || 'Falha ao atualizar serviço/viatura'}\`,
        detalhes: {
          prefixo,
          kmFinal,
          matriculaConfirmacao,
          matriculaAtiva: viatura.matricula_ativa,
          servicoId: viatura.servico_atual_id,
          ehOutroMilitar
        },
        erro: err,
        severidade: 'critico'
      });
      showAlert("Erro", "Não foi possível finalizar o serviço.", "danger");
      setSubmitting(false);
    }`;

content = content.replace(oldFinalizarCatch, newFinalizarCatch);

fs.writeFileSync(viaturaPath, content, 'utf8');
console.log('Successfully updated Viatura.jsx with error logging!');

